import type { AccountingFinanceConfiguration, LabourPriceMatrix, Settings, Vehicle } from './contracts.js';

// Exact customer-facing tariff values extracted from the supplied reference file.
export const referenceAssemblyPriceDefaults = {
  salon: {
    local: 5200,
    import: 7800,
    sz: {
      '1': {
        local: 2600,
        import: 3900,
      },
      '2': {
        local: 5200,
        import: 7800,
      },
      '3': {
        local: 6500,
        import: 9100,
      },
      '4': {
        local: 9100,
        import: 13000,
      },
      '5': {
        local: 13000,
        import: 15600,
      },
      '6': {
        local: 15600,
        import: 19500,
      },
      '7': {
        local: 19500,
        import: 23400,
      },
      '8': {
        local: 22100,
        import: 26000,
      },
      '9': {
        local: 24700,
        import: 27300,
      },
      '10': {
        local: 27300,
        import: 31200,
      },
    },
  },
  tbasse: {
    local: 2600,
    import: 5200,
  },
  meubletv: {
    local: 6500,
    import: 9100,
  },
  tv: {
    local: 0,
    import: 0,
  },
  tablem: {
    local: 5200,
    import: 6500,
    sz: {
      '2': {
        local: 5200,
        import: 6500,
      },
      '3': {
        local: 6500,
        import: 7800,
      },
      '4': {
        local: 6500,
        import: 9100,
      },
      '5': {
        local: 6500,
        import: 9100,
      },
      '6': {
        local: 6500,
        import: 9100,
      },
      '7': {
        local: 6500,
        import: 9100,
      },
      '8': {
        local: 6500,
        import: 9100,
      },
      '9': {
        local: 6500,
        import: 9100,
      },
      '10': {
        local: 7800,
        import: 13000,
      },
      '11': {
        local: 7800,
        import: 13000,
      },
      '12': {
        local: 7800,
        import: 13000,
      },
    },
  },
  chaise: {
    local: 0,
    import: 0,
  },
  buffet: {
    local: 9100,
    import: 13000,
  },
  biblio: {
    local: 13000,
    import: 19500,
  },
  vitrine: {
    local: 0,
    import: 0,
  },
  tapis: {
    local: 0,
    import: 0,
  },
  lit: {
    local: 3900,
    import: 6500,
    sz: {
      '1': {
        local: 3250,
        import: 3900,
      },
      '2': {
        local: 3900,
        import: 6500,
      },
      '3': {
        local: 6500,
        import: 13000,
      },
      '4': {
        local: 0,
        import: 0,
      },
    },
  },
  matelas: {
    local: 0,
    import: 0,
    sz: {
      '1': {
        local: 0,
        import: 0,
      },
      '2': {
        local: 0,
        import: 0,
      },
      '3': {
        local: 0,
        import: 0,
      },
      '4': {
        local: 0,
        import: 0,
      },
    },
  },
  armoire: {
    local: 5200,
    import: 6500,
    sz: {
      '1': {
        local: 3900,
        import: 6500,
      },
      '2': {
        local: 5200,
        import: 6500,
      },
      '3': {
        local: 6500,
        import: 9100,
      },
      '4': {
        local: 6500,
        import: 13000,
      },
      '5': {
        local: 6500,
        import: 13000,
      },
      '6': {
        local: 6500,
        import: 13000,
      },
      '7': {
        local: 6500,
        import: 13000,
      },
      '8': {
        local: 6500,
        import: 13000,
      },
    },
  },
  coiffeuse: {
    local: 0,
    import: 0,
  },
  commode: {
    local: 0,
    import: 0,
  },
  chevet: {
    local: 0,
    import: 0,
  },
  bureau: {
    local: 6500,
    import: 13000,
  },
  frigo: {
    local: 0,
    import: 0,
  },
  congel: {
    local: 0,
    import: 0,
  },
} satisfies NonNullable<Settings['montageP']>;

export const referenceVehiclePrices: Record<string, Vehicle['prices']> = {
  trafic: [15000, 18500, 22000],
  sprinter: [28000, 34500, 41500],
  master: [25000, 31000, 37000],
};

export function createReferenceLabourPriceMatrix(): LabourPriceMatrix {
  const legacy = (floor: number, lift: boolean) => floor <= 0 ? 0 : lift ? 500 : floor * 500;
  const scenarios = { none: [false, false], from: [true, false], to: [false, true], both: [true, true] } as const;
  return Object.fromEntries(Object.entries(scenarios).map(([key, [fromLift, toLift]]) => [
    key, Array.from({ length: 6 }, (_, from) => Array.from({ length: 6 }, (_, to) =>
      6500 + legacy(from, fromLift) + legacy(to, toLift))),
  ])) as LabourPriceMatrix;
}

// Payroll rates from MNGRID and gridOf('pay') in the supplied reference.
export const referenceAssemblyPayrollDefaults = {
  "salon": {
    "local": 4000,
    "import": 6000,
    "sz": {
      "1": {
        "local": 2000,
        "import": 3000
      },
      "2": {
        "local": 4000,
        "import": 6000
      },
      "3": {
        "local": 5000,
        "import": 7000
      },
      "4": {
        "local": 7000,
        "import": 10000
      },
      "5": {
        "local": 10000,
        "import": 12000
      },
      "6": {
        "local": 12000,
        "import": 15000
      },
      "7": {
        "local": 15000,
        "import": 18000
      },
      "8": {
        "local": 17000,
        "import": 20000
      },
      "9": {
        "local": 19000,
        "import": 21000
      },
      "10": {
        "local": 21000,
        "import": 24000
      }
    }
  },
  "tbasse": {
    "local": 2000,
    "import": 4000
  },
  "meubletv": {
    "local": 5000,
    "import": 7000
  },
  "tv": {
    "local": 0,
    "import": 0
  },
  "tablem": {
    "local": 4000,
    "import": 5000,
    "sz": {
      "2": {
        "local": 4000,
        "import": 5000
      },
      "3": {
        "local": 5000,
        "import": 6000
      },
      "4": {
        "local": 5000,
        "import": 7000
      },
      "5": {
        "local": 5000,
        "import": 7000
      },
      "6": {
        "local": 5000,
        "import": 7000
      },
      "7": {
        "local": 5000,
        "import": 7000
      },
      "8": {
        "local": 5000,
        "import": 7000
      },
      "9": {
        "local": 5000,
        "import": 7000
      },
      "10": {
        "local": 6000,
        "import": 10000
      },
      "11": {
        "local": 6000,
        "import": 10000
      },
      "12": {
        "local": 6000,
        "import": 10000
      }
    }
  },
  "chaise": {
    "local": 0,
    "import": 0
  },
  "buffet": {
    "local": 7000,
    "import": 10000
  },
  "biblio": {
    "local": 10000,
    "import": 15000
  },
  "vitrine": {
    "local": 0,
    "import": 0
  },
  "tapis": {
    "local": 0,
    "import": 0
  },
  "lit": {
    "local": 3000,
    "import": 5000,
    "sz": {
      "1": {
        "local": 2500,
        "import": 3000
      },
      "2": {
        "local": 3000,
        "import": 5000
      },
      "3": {
        "local": 5000,
        "import": 10000
      },
      "4": {
        "local": 0,
        "import": 0
      }
    }
  },
  "matelas": {
    "local": 0,
    "import": 0,
    "sz": {
      "1": {
        "local": 0,
        "import": 0
      },
      "2": {
        "local": 0,
        "import": 0
      },
      "3": {
        "local": 0,
        "import": 0
      },
      "4": {
        "local": 0,
        "import": 0
      }
    }
  },
  "armoire": {
    "local": 4000,
    "import": 5000,
    "sz": {
      "1": {
        "local": 3000,
        "import": 5000
      },
      "2": {
        "local": 4000,
        "import": 5000
      },
      "3": {
        "local": 5000,
        "import": 7000
      },
      "4": {
        "local": 5000,
        "import": 10000
      },
      "5": {
        "local": 5000,
        "import": 10000
      },
      "6": {
        "local": 5000,
        "import": 10000
      },
      "7": {
        "local": 5000,
        "import": 10000
      },
      "8": {
        "local": 5000,
        "import": 10000
      }
    }
  },
  "coiffeuse": {
    "local": 0,
    "import": 0
  },
  "commode": {
    "local": 0,
    "import": 0
  },
  "chevet": {
    "local": 0,
    "import": 0
  },
  "bureau": {
    "local": 5000,
    "import": 10000
  },
  "frigo": {
    "local": 0,
    "import": 0
  },
  "congel": {
    "local": 0,
    "import": 0
  }
} satisfies AccountingFinanceConfiguration['menuPrices'];
