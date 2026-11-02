/**
 * Rewrite bulk-seeded spare parts so `price` / `mrp` are per-unit paise
 * for that part category, not the random ₹2,000/₹10,000 values that looked
 * like the value of the whole stock.
 *
 * Only touches SKUs from seed-5000-parts.js (SP-XXX-YYY-00000).
 *
 * Usage: MONGO_URI=mongodb://127.0.0.1:27017/fixxer node scripts/fix-spare-part-unit-prices.js
 */

const mongoose = require('mongoose');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/fixxer';
const BULK_SKU = /^SP-[A-Z]{3}-[A-Z]{3}-\d{5}$/;

const UNIT_PRICE_RUPEES = {
  'Cooling & Compressor': [2800, 9500],
  Compressors: [3500, 12000],
  'Motors & Drive': [900, 3800],
  Motors: [700, 2800],
  'Drums & Tubs': [2200, 7500],
  'Belts & Pulleys': [180, 650],
  'Controls & PCB': [850, 3200],
  'Control Boards': [900, 3500],
  'Control Panels': [600, 2200],
  'Controls & Sensors': [350, 1600],
  'Cooling Fans': [320, 1100],
  'Seals & Gaskets': [180, 850],
  'Ice Maker': [700, 2400],
  'Water System': [220, 900],
  'Shelves & Drawers': [350, 1400],
  Lighting: [120, 550],
  'LED Backlights': [400, 1800],
  'Inlet Valves': [250, 850],
  'Drain Pumps': [380, 1200],
  Bearings: [150, 700],
  Fasteners: [40, 220],
  'Condenser Coils': [1200, 4500],
  'Evaporator Coils': [1100, 4200],
  Thermostats: [180, 750],
  'Capillary Tubes': [80, 350],
  Filters: [150, 650],
  Magnetrons: [900, 2800],
  Transformers: [450, 1600],
  Capacitors: [80, 450],
  'Heating Elements': [280, 1100],
  'Waveguide Covers': [120, 480],
  'Stirrer Motors': [250, 900],
  Turntables: [180, 700],
  'RO Membranes': [400, 1400],
  'Pre-Filters': [150, 550],
  'Carbon Filters': [180, 650],
  Cartridges: [150, 600],
  'Valves & Fittings': [80, 400],
  'TDS Meters': [200, 800],
  Pumps: [500, 1800],
  Housings: [250, 950],
  'Power Supplies': [700, 2500],
  'Main Boards': [1200, 4500],
  'T-Con Boards': [800, 2800],
  'Panel Cables': [150, 600],
  'Remote Controls': [250, 900],
  Speakers: [300, 1100],
  'Temperature Sensors': [150, 650],
  'Relief Valves': [120, 480],
  'Inlets & Outlets': [80, 350],
  'Pipes & Fittings': [60, 300],
  Insulation: [100, 450],
  Regulators: [150, 600],
  Blades: [200, 800],
  Wiring: [80, 400],
  'Speed Controllers': [180, 750],
  default: [250, 1200],
};

const CATEGORY_PART_NAMES = {
  'Cooling & Compressor': ['Rotary Compressor', 'Scroll Compressor', 'Inverter Compressor'],
  Compressors: ['Rotary Compressor', 'Scroll Compressor', 'Inverter Compressor'],
  'Motors & Drive': ['AC Induction Motor', 'BLDC Motor', 'Universal Motor'],
  Motors: ['Fan Motor', 'BLDC Motor', 'Condenser Fan Motor'],
  'Drums & Tubs': ['Stainless Steel Drum', 'Porcelain Tub', 'Aluminum Drum'],
  'Belts & Pulleys': ['Drive Belt', 'Motor Pulley', 'Drum Pulley'],
  'Controls & PCB': ['Main Control Board', 'Power Module', 'Display PCB'],
  'Control Boards': ['Main Control Board', 'Inverter PCB', 'Display Board'],
  'Control Panels': ['Touch Control Panel', 'Membrane Keypad', 'Display Panel'],
  'Controls & Sensors': ['Temperature Sensor', 'Door Switch', 'Defrost Sensor'],
  'Cooling Fans': ['Condenser Fan Motor', 'Evaporator Fan', 'Circulation Fan'],
  'Seals & Gaskets': ['Door Gasket', 'Shaft Seal', 'Lid Seal'],
  'Ice Maker': ['Ice Maker Assembly', 'Ice Tray', 'Ice Maker Motor'],
  'Water System': ['Water Inlet Valve', 'Water Filter', 'Dispenser Valve'],
  'Shelves & Drawers': ['Glass Shelf', 'Crisper Drawer', 'Door Bin'],
  Lighting: ['LED Lamp', 'Cabinet Light', 'Lamp Cover'],
  'LED Backlights': ['LED Strip', 'Backlight Bar', 'LED Lens'],
  'Inlet Valves': ['Single Inlet Valve', 'Double Inlet Valve', 'Inlet Hose'],
  'Drain Pumps': ['Drain Pump', 'Drain Motor', 'Drain Hose'],
  Bearings: ['Drum Bearing', 'Rear Bearing', 'Bearing Kit'],
  Fasteners: ['Stainless Steel Screw', 'Mounting Bracket', 'Cable Clip'],
  'Condenser Coils': ['Condenser Coil', 'Condenser Assembly'],
  'Evaporator Coils': ['Evaporator Coil', 'Evaporator Assembly'],
  Thermostats: ['Bimetal Thermostat', 'Electronic Thermostat', 'Temperature Sensor'],
  'Capillary Tubes': ['Capillary Tube', 'Capillary Assembly'],
  Filters: ['Cabin Filter', 'Mesh Filter', 'Drain Filter'],
  Magnetrons: ['2M246J Magnetron', 'High Power Magnetron'],
  Transformers: ['High Voltage Transformer', 'Power Transformer'],
  Capacitors: ['Run Capacitor', 'Start Capacitor', 'Filter Capacitor'],
  'Heating Elements': ['Tubular Heater', 'Immersion Heater', 'Resistance Coil'],
  'Waveguide Covers': ['Waveguide Cover', 'Mica Sheet'],
  'Stirrer Motors': ['Stirrer Motor', 'Stirrer Fan'],
  Turntables: ['Glass Turntable', 'Turntable Coupler', 'Turntable Motor'],
  'RO Membranes': ['75 GPD RO Membrane', '100 GPD RO Membrane'],
  'Pre-Filters': ['1 Micron Cartridge', 'Sediment Filter'],
  'Carbon Filters': ['Carbon Filter', 'Post-Carbon Cartridge'],
  Cartridges: ['Sediment Cartridge', 'Inline Cartridge'],
  'Valves & Fittings': ['Check Valve', 'Elbow Fitting', 'Quick Connect'],
  'TDS Meters': ['TDS Meter', 'Inline TDS Sensor'],
  Pumps: ['Booster Pump', 'RO Pump'],
  Housings: ['Filter Housing', 'Membrane Housing'],
  'Power Supplies': ['SMPS Board', 'Power Supply Module', 'LED Driver'],
  'Main Boards': ['Main Board', 'Logic Board'],
  'T-Con Boards': ['T-Con Board', 'Timing Controller'],
  'Panel Cables': ['LVDS Cable', 'Panel Flex Cable'],
  'Remote Controls': ['IR Remote', 'Smart Remote', 'RF Remote'],
  Speakers: ['TV Speaker', 'Speaker Pair'],
  'Temperature Sensors': ['NTC Sensor', 'Thermistor'],
  'Relief Valves': ['Pressure Relief Valve', 'Safety Valve'],
  'Inlets & Outlets': ['Inlet Pipe', 'Outlet Pipe'],
  'Pipes & Fittings': ['Connection Pipe', 'Union Fitting'],
  Insulation: ['Tank Insulation', 'Foam Jacket'],
  Regulators: ['Fan Regulator', 'Stepped Regulator'],
  Blades: ['Aluminum Blade Set', 'Wooden Blade Set', 'Replacement Blades'],
  Wiring: ['Power Cord', 'Cable Harness', 'Wire Loom'],
  'Speed Controllers': ['Speed Controller', 'Electronic Regulator'],
};

const BRAND_LABEL = {
  lg: 'LG',
  ifb: 'IFB',
  'ao-smith': 'AO Smith',
};

function hash(value) {
  let h = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    h ^= value.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function pick(list, seed) {
  return list[seed % list.length];
}

function brandLabel(slug) {
  if (!slug) return 'Universal';
  if (BRAND_LABEL[slug]) return BRAND_LABEL[slug];
  return slug
    .split('-')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

function unitPaise(category, sku) {
  const [minRupees, maxRupees] = UNIT_PRICE_RUPEES[category] || UNIT_PRICE_RUPEES.default;
  const rupees = minRupees + (hash(sku) % (maxRupees - minRupees + 1));
  return rupees * 100;
}

async function run() {
  await mongoose.connect(MONGO_URI);
  const col = mongoose.connection.db.collection('spareparts');
  const cursor = col.find({ sku: BULK_SKU });
  const ops = [];
  let scanned = 0;
  let rewrittenNames = 0;

  while (await cursor.hasNext()) {
    const part = await cursor.next();
    scanned += 1;
    const price = unitPaise(part.partCategory, part.sku);
    const ratio = part.price > 0 && part.mrp > part.price ? part.mrp / part.price : 1.18;
    const mrp = Math.round((price / 100) * ratio) * 100;
    const patch = { price, mrp };

    if (typeof part.name === 'string' && /spare part$/i.test(part.name.trim())) {
      const names = CATEGORY_PART_NAMES[part.partCategory] || [part.partCategory || 'Spare Part'];
      const partName = pick(names, hash(`${part.sku}:name`));
      patch.name = `${brandLabel(part.brandSlug)} ${partName}`;
      rewrittenNames += 1;
    }

    ops.push({
      updateOne: {
        filter: { _id: part._id },
        update: { $set: patch },
      },
    });
  }

  if (ops.length) {
    const BATCH = 500;
    for (let i = 0; i < ops.length; i += BATCH) {
      await col.bulkWrite(ops.slice(i, i + BATCH), { ordered: false });
    }
  }

  const sample = await col
    .find({ sku: BULK_SKU }, { projection: { sku: 1, name: 1, partCategory: 1, price: 1, mrp: 1, stock: 1 } })
    .sort({ soldCount: -1 })
    .limit(8)
    .toArray();

  console.log(
    JSON.stringify(
      {
        scanned,
        updated: ops.length,
        rewrittenNames,
        sample: sample.map((row) => ({
          sku: row.sku,
          name: row.name,
          category: row.partCategory,
          unitRupees: row.price / 100,
          mrpRupees: row.mrp / 100,
          stock: row.stock,
        })),
      },
      null,
      2,
    ),
  );

  await mongoose.disconnect();
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
