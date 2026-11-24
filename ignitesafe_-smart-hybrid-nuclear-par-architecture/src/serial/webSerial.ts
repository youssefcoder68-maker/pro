import type { TelemetryInputs, TinyMlPacket } from '../sim/types';
import {
  formatOutgoingDataPacket,
  formatResetCommand,
  parseIncomingSerialLine,
} from './protocol';

interface SerialPortLike {
  open(options: { baudRate: number }): Promise<void>;
  close(): Promise<void>;
  readable: ReadableStream<Uint8Array> | null;
  writable: WritableStream<Uint8Array> | null;
}

interface NavigatorWithSerial extends Navigator {
  serial?: {
    requestPort(): Promise<SerialPortLike>;
  };
}

export interface SerialCallbacks {
  onPacket: (packet: TinyMlPacket, rawLine: string) => void;
  onLog: (direction: 'TX' | 'RX' | 'SYS', payload: string) => void;
  onStatusChange: (connected: boolean, label: string, errorHint?: string) => void;
  onVerificationChange?: (verified: boolean, verifiedAtMs?: number) => void;
}

export class ArduinoSerialClient {
  private port: SerialPortLike | null = null;
  private writer: WritableStreamDefaultWriter<Uint8Array> | null = null;
  private reader: ReadableStreamDefaultReader<string> | null = null;
  private readAbort = false;
  private verified = false;
  private bootloaderTimers: number[] = [];
  private encoder = new TextEncoder();
  private callbacks: SerialCallbacks;

  constructor(callbacks: SerialCallbacks) {
    this.callbacks = callbacks;
  }

  public static isSupported(): boolean {
    return typeof navigator !== 'undefined' && 'serial' in navigator;
  }

  public static isIframeBlocked(): boolean {
    if (typeof window === 'undefined') return false;
    try {
      return window.self !== window.top;
    } catch {
      return true;
    }
  }

  public isConnected(): boolean {
    return this.port !== null && this.writer !== null;
  }

  public isVerified(): boolean {
    return this.isConnected() && this.verified;
  }

  private clearBootloaderTimers(): void {
    this.bootloaderTimers.forEach((id) => window.clearTimeout(id));
    this.bootloaderTimers = [];
  }

  public async pingHandshake(inputs?: TelemetryInputs): Promise<void> {
    if (!this.isConnected()) return;
    await this.sendReset();
    if (inputs) {
      await new Promise((r) => window.setTimeout(r, 90));
      await this.sendData(inputs.h2, inputs.rate, inputs.sTemp, inputs.bTemp);
    }
  }

  public async connect(baudRate = 9600, initialInputs?: TelemetryInputs): Promise<boolean> {
    const nav = navigator as NavigatorWithSerial;
    if (!nav.serial) {
      const hint =
        'Web Serial requires Chrome or Edge over HTTPS / localhost.';
      this.callbacks.onLog('SYS', hint);
      this.callbacks.onStatusChange(false, 'Browser Unsupported', hint);
      this.callbacks.onVerificationChange?.(false);
      return false;
    }

    try {
      this.clearBootloaderTimers();
      const port = await nav.serial.requestPort();
      await port.open({ baudRate });
      this.port = port;
      this.readAbort = false;
      this.verified = false;
      this.callbacks.onVerificationChange?.(false);

      if (port.writable) {
        this.writer = port.writable.getWriter();
      }

      this.callbacks.onStatusChange(true, `USB Open (${baudRate} Baud) · Verifying...`);
      this.callbacks.onLog(
        'SYS',
        `USB Serial connected at ${baudRate} baud. Waiting for Arduino Uno boot & JSON verification...`
      );
      void this.readLoop();

      // Arduino Uno auto-resets via DTR (~1.5s bootloader); send RESET handshake twice to guarantee receipt.
      this.bootloaderTimers.push(
        window.setTimeout(() => {
          if (this.isConnected() && !this.verified) {
            void this.pingHandshake(initialInputs);
          }
        }, 450),
        window.setTimeout(() => {
          if (this.isConnected() && !this.verified) {
            void this.pingHandshake(initialInputs);
          }
        }, 1850)
      );

      return true;
    } catch (err) {
      const name = err instanceof Error ? err.name : '';
      const msg = err instanceof Error ? err.message : 'Connection failed';
      let hint = `Serial connect error: ${msg}`;

      if (name === 'SecurityError' || /permissions policy|serial/i.test(msg)) {
        hint =
          'Embedded iframe blocked USB Web Serial permission. Open this app in a full Chrome/Edge tab to connect Arduino directly.';
      } else if (name === 'NotFoundError') {
        hint = 'No serial port selected. Plug in Arduino Uno USB cable and select its COM/tty port.';
      } else if (name === 'NetworkError' || /open/i.test(msg)) {
        hint = 'Port is busy! Close Arduino IDE Serial Monitor before connecting from the browser.';
      }

      this.callbacks.onLog('SYS', hint);
      this.callbacks.onStatusChange(false, 'Not Connected', hint);
      this.callbacks.onVerificationChange?.(false);
      return false;
    }
  }

  private async readLoop(): Promise<void> {
    if (!this.port?.readable) return;
    const decoder = new TextDecoderStream();
    const pipePromise = this.port.readable
      .pipeTo(decoder.writable as unknown as WritableStream<Uint8Array>)
      .catch(() => undefined);

    this.reader = decoder.readable.getReader();
    let buffer = '';

    try {
      while (!this.readAbort) {
        const { value, done } = await this.reader.read();
        if (done) break;
        if (value) {
          buffer += value;
          let newlineIdx = buffer.indexOf('\n');
          while (newlineIdx !== -1) {
            const line = buffer.slice(0, newlineIdx).replace(/\r/g, '').trim();
            buffer = buffer.slice(newlineIdx + 1);
            if (line.length > 0) {
              this.callbacks.onLog('RX', line);
              const jsonStart = line.indexOf('{');
              const jsonEnd = line.lastIndexOf('}');
              const jsonCandidate =
                jsonStart !== -1 && jsonEnd > jsonStart ? line.slice(jsonStart, jsonEnd + 1) : line;
              const packet = parseIncomingSerialLine(jsonCandidate);
              if (packet) {
                if (!this.verified) {
                  this.verified = true;
                  this.callbacks.onVerificationChange?.(true, Date.now());
                  this.callbacks.onStatusChange(true, 'Arduino Verified ✅ (9600 Baud)');
                } else {
                  this.callbacks.onVerificationChange?.(true, Date.now());
                }
                this.callbacks.onPacket(packet, line);
              }
            }
            newlineIdx = buffer.indexOf('\n');
          }
        }
      }
    } catch {
      if (!this.readAbort) {
        this.callbacks.onLog('SYS', 'Arduino USB serial link interrupted.');
        await this.disconnect();
      }
    } finally {
      await pipePromise;
    }
  }

  public async sendData(h2: number, rate: number, sTemp: number, bTemp: number): Promise<void> {
    const packetStr = formatOutgoingDataPacket(h2, rate, sTemp, bTemp);
    if (!this.writer) return;
    try {
      await this.writer.write(this.encoder.encode(packetStr));
      this.callbacks.onLog('TX', packetStr.trim());
    } catch {
      await this.disconnect();
    }
  }

  public async sendReset(): Promise<void> {
    const cmd = formatResetCommand();
    if (!this.writer) return;
    try {
      await this.writer.write(this.encoder.encode(cmd));
      this.callbacks.onLog('TX', 'RESET');
    } catch {
      await this.disconnect();
    }
  }

  public async disconnect(): Promise<void> {
    this.readAbort = true;
    this.verified = false;
    this.clearBootloaderTimers();
    try {
      await this.reader?.cancel();
    } catch {
      // ignore
    }
    try {
      this.reader?.releaseLock();
    } catch {
      // ignore
    }
    try {
      this.writer?.releaseLock();
    } catch {
      // ignore
    }
    try {
      await this.port?.close();
    } catch {
      // ignore
    }
    this.reader = null;
    this.writer = null;
    this.port = null;
    this.callbacks.onVerificationChange?.(false);
    this.callbacks.onStatusChange(false, 'Disconnected');
    this.callbacks.onLog('SYS', 'Arduino Uno USB disconnected.');
  }
}
