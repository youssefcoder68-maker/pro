import type { TinyMlPacket } from './types';

export interface RandomForestTrace {
  decision: 0 | 1 | 2 | 3;
  state: TinyMlPacket['state'];
  pulse: 0 | 1;
  treeVotes: [number, number, number, number];
  perTreePredictions: [0 | 1 | 2 | 3, 0 | 1 | 2 | 3, 0 | 1 | 2 | 3, 0 | 1 | 2 | 3, 0 | 1 | 2 | 3];
  us: number;
}

const LABELS: Record<0 | 1 | 2 | 3, TinyMlPacket['state']> = {
  0: 'SAFE',
  1: 'TRIGGER',
  2: 'EXOTHERMIC',
  3: 'FAILSAFE',
};

function predictTree1(x: readonly [number, number, number, number]): 0 | 1 | 2 | 3 {
  if (x[1] <= 0.62049999833107) {
    if (x[0] <= 3.9999998807907104) {
      if (x[2] <= 149.5999984741211) {
        if (x[0] <= 0.99549999833107) {
          if (x[1] <= 0.45100000500679016) {
            return 0;
          } else {
            if (x[3] <= 62.60000038146973) {
              return 0;
            } else {
              return 0;
            }
          }
        } else {
          if (x[0] <= 3.9394999742507935) {
            if (x[0] <= 3.587999939918518) {
              return 1;
            } else {
              return 1;
            }
          } else {
            if (x[0] <= 3.9415000677108765) {
              return 3;
            } else {
              return 1;
            }
          }
        }
      } else {
        if (x[0] <= 1.001499980688095) {
          return 0;
        } else {
          if (x[1] <= 0.6005000174045563) {
            return 2;
          } else {
            if (x[1] <= 0.6040000021457672) {
              return 3;
            } else {
              return 2;
            }
          }
        }
      }
    } else {
      return 3;
    }
  } else {
    if (x[2] <= 149.8499984741211) {
      if (x[3] <= 54.89999961853027) {
        if (x[0] <= 3.1985000371932983) {
          if (x[3] <= 48.95000076293945) {
            if (x[0] <= 0.7065000236034393) {
              return 0;
            } else {
              return 1;
            }
          } else {
            if (x[3] <= 54.04999923706055) {
              return 1;
            } else {
              return 1;
            }
          }
        } else {
          return 3;
        }
      } else {
        if (x[3] <= 65.35000228881836) {
          if (x[0] <= 3.1855000257492065) {
            if (x[2] <= 132.5) {
              return 1;
            } else {
              return 0;
            }
          } else {
            return 3;
          }
        } else {
          if (x[0] <= 3.1924999952316284) {
            if (x[0] <= 0.7014999985694885) {
              return 0;
            } else {
              return 1;
            }
          } else {
            return 3;
          }
        }
      }
    } else {
      if (x[2] <= 188.25) {
        if (x[3] <= 29.65000057220459) {
          if (x[0] <= 0.9900000095367432) {
            return 0;
          } else {
            if (x[0] <= 3.180000066757202) {
              return 2;
            } else {
              return 3;
            }
          }
        } else {
          if (x[0] <= 3.177500009536743) {
            if (x[0] <= 0.9949999749660492) {
              return 0;
            } else {
              return 2;
            }
          } else {
            return 3;
          }
        }
      } else {
        if (x[2] <= 194.3499984741211) {
          if (x[1] <= 0.9564999938011169) {
            if (x[3] <= 78.0) {
              return 3;
            } else {
              return 2;
            }
          } else {
            if (x[1] <= 0.9835000038146973) {
              return 3;
            } else {
              return 2;
            }
          }
        } else {
          if (x[3] <= 70.94999694824219) {
            if (x[3] <= 67.54999923706055) {
              return 3;
            } else {
              return 2;
            }
          } else {
            if (x[0] <= 3.1850000619888306) {
              return 2;
            } else {
              return 3;
            }
          }
        }
      }
    }
  }
}

function predictTree2(x: readonly [number, number, number, number]): 0 | 1 | 2 | 3 {
  if (x[2] <= 149.9499969482422) {
    if (x[2] <= 100.79999923706055) {
      if (x[0] <= 3.9964998960494995) {
        if (x[3] <= 42.10000038146973) {
          if (x[0] <= 0.8650000095367432) {
            if (x[0] <= 0.7290000021457672) {
              return 0;
            } else {
              return 0;
            }
          } else {
            if (x[1] <= 0.7515000104904175) {
              return 1;
            } else {
              return 1;
            }
          }
        } else {
          if (x[0] <= 0.9169999957084656) {
            if (x[2] <= 99.6500015258789) {
              return 0;
            } else {
              return 0;
            }
          } else {
            if (x[1] <= 0.6134999990463257) {
              return 1;
            } else {
              return 1;
            }
          }
        }
      } else {
        if (x[0] <= 3.999500036239624) {
          if (x[1] <= 0.40150000154972076) {
            return 1;
          } else {
            return 3;
          }
        } else {
          return 3;
        }
      }
    } else {
      if (x[0] <= 3.9704999923706055) {
        if (x[3] <= 48.19999885559082) {
          if (x[3] <= 43.0) {
            if (x[0] <= 0.8109999895095825) {
              return 0;
            } else {
              return 1;
            }
          } else {
            if (x[0] <= 0.8510000109672546) {
              return 0;
            } else {
              return 1;
            }
          }
        } else {
          if (x[0] <= 0.9905000030994415) {
            if (x[0] <= 0.7349999845027924) {
              return 0;
            } else {
              return 0;
            }
          } else {
            if (x[0] <= 3.284000039100647) {
              return 1;
            } else {
              return 1;
            }
          }
        }
      } else {
        if (x[0] <= 3.9984999895095825) {
          if (x[1] <= 0.5589999854564667) {
            return 1;
          } else {
            return 3;
          }
        } else {
          return 3;
        }
      }
    }
  } else {
    if (x[3] <= 50.85000038146973) {
      if (x[2] <= 150.75) {
        return 2;
      } else {
        if (x[0] <= 3.962000012397766) {
          if (x[1] <= 0.6354999840259552) {
            if (x[3] <= 27.300000190734863) {
              return 2;
            } else {
              return 2;
            }
          } else {
            if (x[0] <= 3.1820000410079956) {
              return 2;
            } else {
              return 3;
            }
          }
        } else {
          return 3;
        }
      }
    } else {
      if (x[1] <= 0.5825000107288361) {
        if (x[3] <= 53.45000076293945) {
          if (x[0] <= 1.0139999687671661) {
            return 0;
          } else {
            if (x[1] <= 0.34950000047683716) {
              return 2;
            } else {
              return 2;
            }
          }
        } else {
          if (x[3] <= 53.95000076293945) {
            if (x[1] <= 0.5225000083446503) {
              return 3;
            } else {
              return 0;
            }
          } else {
            if (x[0] <= 3.99399995803833) {
              return 2;
            } else {
              return 3;
            }
          }
        }
      } else {
        if (x[2] <= 152.0500030517578) {
          if (x[0] <= 3.009999990463257) {
            if (x[2] <= 150.5500030517578) {
              return 0;
            } else {
              return 2;
            }
          } else {
            return 3;
          }
        } else {
          if (x[1] <= 0.8125) {
            if (x[1] <= 0.7384999990463257) {
              return 3;
            } else {
              return 3;
            }
          } else {
            if (x[0] <= 3.1855000257492065) {
              return 2;
            } else {
              return 3;
            }
          }
        }
      }
    }
  }
}

function predictTree3(x: readonly [number, number, number, number]): 0 | 1 | 2 | 3 {
  if (x[0] <= 3.944499969482422) {
    if (x[1] <= 0.6005000174045563) {
      if (x[3] <= 66.25) {
        if (x[2] <= 149.9499969482422) {
          if (x[0] <= 0.910999983549118) {
            if (x[1] <= 0.45749999582767487) {
              return 0;
            } else {
              return 0;
            }
          } else {
            if (x[0] <= 0.9539999961853027) {
              return 1;
            } else {
              return 1;
            }
          }
        } else {
          if (x[0] <= 0.9949999749660492) {
            return 0;
          } else {
            return 2;
          }
        }
      } else {
        if (x[3] <= 95.35000228881836) {
          if (x[2] <= 150.1999969482422) {
            if (x[2] <= 137.0500030517578) {
              return 1;
            } else {
              return 1;
            }
          } else {
            if (x[0] <= 1.0025000274181366) {
              return 0;
            } else {
              return 2;
            }
          }
        } else {
          if (x[0] <= 0.99549999833107) {
            return 0;
          } else {
            if (x[0] <= 1.071999967098236) {
              return 1;
            } else {
              return 2;
            }
          }
        }
      }
    } else {
      if (x[3] <= 52.85000038146973) {
        if (x[2] <= 149.4499969482422) {
          if (x[2] <= 120.75) {
            if (x[0] <= 0.6875) {
              return 0;
            } else {
              return 1;
            }
          } else {
            if (x[3] <= 31.049999237060547) {
              return 1;
            } else {
              return 1;
            }
          }
        } else {
          if (x[0] <= 3.1820000410079956) {
            if (x[2] <= 150.0) {
              return 0;
            } else {
              return 2;
            }
          } else {
            return 3;
          }
        }
      } else {
        if (x[2] <= 149.95000457763672) {
          if (x[2] <= 65.95000076293945) {
            if (x[0] <= 3.087999939918518) {
              return 1;
            } else {
              return 3;
            }
          } else {
            if (x[0] <= 3.1924999952316284) {
              return 1;
            } else {
              return 3;
            }
          }
        } else {
          if (x[2] <= 269.79998779296875) {
            if (x[2] <= 259.90000915527344) {
              return 2;
            } else {
              return 2;
            }
          } else {
            if (x[0] <= 1.0395000278949738) {
              return 0;
            } else {
              return 3;
            }
          }
        }
      }
    }
  } else {
    if (x[0] <= 3.999500036239624) {
      if (x[1] <= 0.597000002861023) {
        if (x[0] <= 3.987499952316284) {
          if (x[3] <= 76.39999771118164) {
            if (x[2] <= 153.9499969482422) {
              return 1;
            } else {
              return 2;
            }
          } else {
            return 2;
          }
        } else {
          if (x[3] <= 81.55000305175781) {
            return 1;
          } else {
            if (x[3] <= 94.85000228881836) {
              return 2;
            } else {
              return 1;
            }
          }
        }
      } else {
        return 3;
      }
    } else {
      return 3;
    }
  }
}

function predictTree4(x: readonly [number, number, number, number]): 0 | 1 | 2 | 3 {
  if (x[2] <= 149.9499969482422) {
    if (x[0] <= 3.9964998960494995) {
      if (x[1] <= 0.6315000057220459) {
        if (x[2] <= 102.64999771118164) {
          if (x[0] <= 0.9900000095367432) {
            if (x[0] <= 0.8684999942779541) {
              return 0;
            } else {
              return 0;
            }
          } else {
            if (x[3] <= 26.15000057220459) {
              return 1;
            } else {
              return 1;
            }
          }
        } else {
          if (x[0] <= 0.9825000166893005) {
            if (x[1] <= 0.45100000500679016) {
              return 0;
            } else {
              return 0;
            }
          } else {
            if (x[0] <= 3.5230000019073486) {
              return 1;
            } else {
              return 1;
            }
          }
        }
      } else {
        if (x[3] <= 30.34999942779541) {
          if (x[0] <= 0.7529999911785126) {
            return 0;
          } else {
            if (x[0] <= 3.219499945640564) {
              return 1;
            } else {
              return 3;
            }
          }
        } else {
          if (x[2] <= 138.20000457763672) {
            if (x[0] <= 3.194000005722046) {
              return 1;
            } else {
              return 3;
            }
          } else {
            if (x[3] <= 30.899999618530273) {
              return 3;
            } else {
              return 1;
            }
          }
        }
      }
    } else {
      if (x[0] <= 3.9984999895095825) {
        if (x[1] <= 0.5589999854564667) {
          return 1;
        } else {
          return 3;
        }
      } else {
        return 3;
      }
    }
  } else {
    if (x[1] <= 0.6184999942779541) {
      if (x[3] <= 109.45000076293945) {
        if (x[3] <= 106.5999984741211) {
          if (x[0] <= 3.9994999170303345) {
            if (x[3] <= 56.35000038146973) {
              return 2;
            } else {
              return 2;
            }
          } else {
            return 3;
          }
        } else {
          if (x[0] <= 4.038500070571899) {
            if (x[1] <= 0.5774999856948853) {
              return 2;
            } else {
              return 0;
            }
          } else {
            return 3;
          }
        }
      } else {
        if (x[2] <= 260.1999969482422) {
          if (x[1] <= 0.3164999932050705) {
            if (x[3] <= 109.6500015258789) {
              return 2;
            } else {
              return 3;
            }
          } else {
            if (x[2] <= 178.25) {
              return 3;
            } else {
              return 0;
            }
          }
        } else {
          if (x[0] <= 4.639999985694885) {
            return 2;
          } else {
            return 3;
          }
        }
      }
    } else {
      if (x[0] <= 3.1990000009536743) {
        if (x[3] <= 99.45000076293945) {
          if (x[0] <= 1.0024999976158142) {
            return 0;
          } else {
            return 2;
          }
        } else {
          if (x[3] <= 100.4000015258789) {
            return 0;
          } else {
            if (x[2] <= 227.0500030517578) {
              return 0;
            } else {
              return 2;
            }
          }
        }
      } else {
        return 3;
      }
    }
  }
}

function predictTree5(x: readonly [number, number, number, number]): 0 | 1 | 2 | 3 {
  if (x[1] <= 0.5915000140666962) {
    if (x[2] <= 150.0500030517578) {
      if (x[2] <= 53.04999923706055) {
        if (x[1] <= 0.37150000035762787) {
          if (x[0] <= 3.8604999780654907) {
            if (x[0] <= 1.2489999830722809) {
              return 0;
            } else {
              return 1;
            }
          } else {
            return 3;
          }
        } else {
          if (x[3] <= 45.70000076293945) {
            if (x[0] <= 4.000499963760376) {
              return 1;
            } else {
              return 3;
            }
          } else {
            if (x[2] <= 50.39999961853027) {
              return 3;
            } else {
              return 1;
            }
          }
        }
      } else {
        if (x[2] <= 147.75) {
          if (x[2] <= 55.0) {
            if (x[0] <= 4.093000054359436) {
              return 1;
            } else {
              return 3;
            }
          } else {
            if (x[3] <= 41.0) {
              return 3;
            } else {
              return 1;
            }
          }
        } else {
          if (x[3] <= 72.85000228881836) {
            if (x[0] <= 0.9979999959468842) {
              return 0;
            } else {
              return 1;
            }
          } else {
            if (x[2] <= 149.0500030517578) {
              return 1;
            } else {
              return 3;
            }
          }
        }
      }
    } else {
      if (x[0] <= 3.9989999532699585) {
        if (x[3] <= 58.14999961853027) {
          if (x[2] <= 177.4499969482422) {
            if (x[0] <= 0.9144999980926514) {
              return 0;
            } else {
              return 2;
            }
          } else {
            if (x[0] <= 0.9729999601840973) {
              return 0;
            } else {
              return 2;
            }
          }
        } else {
          if (x[0] <= 1.0000000298023224) {
            return 0;
          } else {
            return 2;
          }
        }
      } else {
        return 3;
      }
    }
  } else {
    if (x[0] <= 3.1985000371932983) {
      if (x[3] <= 74.14999771118164) {
        if (x[0] <= 0.8614999949932098) {
          if (x[3] <= 72.04999923706055) {
            if (x[0] <= 0.7175000011920929) {
              return 0;
            } else {
              return 0;
            }
          } else {
            if (x[0] <= 0.6809999942779541) {
              return 0;
            } else {
              return 1;
            }
          }
        } else {
          if (x[2] <= 149.79999542236328) {
            return 1;
          } else {
            if (x[0] <= 0.9779999852180481) {
              return 0;
            } else {
              return 2;
            }
          }
        }
      } else {
        if (x[2] <= 149.85000610351562) {
          if (x[3] <= 103.0) {
            if (x[0] <= 0.6990000009536743) {
              return 0;
            } else {
              return 1;
            }
          } else {
            if (x[2] <= 135.5999984741211) {
              return 0;
            } else {
              return 1;
            }
          }
        } else {
          if (x[3] <= 75.45000076293945) {
            if (x[0] <= 1.0864999890327454) {
              return 0;
            } else {
              return 2;
            }
          } else {
            if (x[0] <= 0.9939999878406525) {
              return 0;
            } else {
              return 2;
            }
          }
        }
      }
    } else {
      if (x[1] <= 0.5974999964237213) {
        if (x[0] <= 4.0019999742507935) {
          return 2;
        } else {
          return 3;
        }
      } else {
        return 3;
      }
    }
  }
}

/**
 * Exact TypeScript mirror of user's `Eloquent::ML::Port::RandomForest::predict(float *x)`
 * running on Arduino Uno.
 * Features vector: x = [h2, rate, sTemp, bTemp].
 */
export function predictEloquentRandomForest(
  h2: number,
  rate: number,
  sTemp: number,
  bTemp: number
): RandomForestTrace {
  const x: readonly [number, number, number, number] = [h2, rate, sTemp, bTemp];
  const t1 = predictTree1(x);
  const t2 = predictTree2(x);
  const t3 = predictTree3(x);
  const t4 = predictTree4(x);
  const t5 = predictTree5(x);

  const votes: [number, number, number, number] = [0, 0, 0, 0];
  votes[t1] += 1;
  votes[t2] += 1;
  votes[t3] += 1;
  votes[t4] += 1;
  votes[t5] += 1;

  let classIdx: 0 | 1 | 2 | 3 = 0;
  let maxVotes = votes[0];
  for (let i = 1; i < 4; i++) {
    if (votes[i] > maxVotes) {
      classIdx = i as 0 | 1 | 2 | 3;
      maxVotes = votes[i];
    }
  }

  // Match Arduino executeAndReport(): pulseActive = 1 on TRIGGER (1) and FAILSAFE (3)
  const pulse: 0 | 1 = classIdx === 1 || classIdx === 3 ? 1 : 0;
  const us = classIdx === 0 ? 39 : classIdx === 1 ? 44 : classIdx === 2 ? 43 : 42;

  return {
    decision: classIdx,
    state: LABELS[classIdx],
    pulse,
    treeVotes: votes,
    perTreePredictions: [t1, t2, t3, t4, t5],
    us,
  };
}
