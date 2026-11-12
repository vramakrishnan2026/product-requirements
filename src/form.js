/* Shared form definition: inlined into both the page and the Worker by build.mjs.
   Edit questions here only. */
const O = (...pairs) => pairs.map(p => Array.isArray(p) ? {v:p[0], l:p[1]} : {v:p, l:p});

const SECTIONS = [
  { id:'overview', title:'Overview', desc:'What is being asked for, and why.', fields:[
    { key:'overview.title', label:'Requirement / product name', type:'text', wide:true, hint:'Working name is fine.' },
    { key:'overview.requested_by', label:'Requested by', type:'text' },
    { key:'overview.date_needed', label:'Needed by', type:'date' },
    { key:'overview.product_type', label:'Product type', type:'select', options:O(['thermostat','Thermostat'],['sensor','Sensor'],['controller','Controller'],['io_module','I/O expansion module'],['gateway','Gateway'],['other','Other']) },
    { key:'overview.product_type_other', label:'Describe product type', type:'text', showIf:{k:'overview.product_type', eq:'other'} },
    { key:'overview.kind', label:'Type of request', type:'select', options:O(['new','New product'],['variant','Variant of an existing product'],['firmware_only','New firmware / profile on existing hardware'],['tbd','Not sure yet']) },
    { key:'overview.base_family', label:'Existing product it builds on', type:'select', options:'@families', showIf:{k:'overview.kind', in:['variant','firmware_only']} },
    { key:'overview.regions', label:'Target regions', type:'multi', wide:true, options:O(['na','North America'],['eu','Europe'],['uk','UK'],['in','India'],['mea','Middle East & Africa'],['apac','Asia Pacific'],['latam','Latin America']) },
    { key:'overview.volume', label:'Expected annual volume', type:'number', unit:'units' },
    { key:'overview.target_cost', label:'Target BOM cost', type:'number', unit:'USD' },
  ]},

  { id:'why', title:'Why', prose:true, desc:'The reason for this product.', fields:[
    { key:'why.text', label:'Why', type:'textarea', wide:true, rows:7,
      hint:'Customer problem and who has it; what exists today and why it does not fit (cost, power, wiring, features); target markets and applications; business opportunity.' },
  ]},

  { id:'what', title:'What', prose:true, desc:'What the product will do.', fields:[
    { key:'what.text', label:'What', type:'textarea', wide:true, rows:7,
      hint:'What the product is and controls; key capabilities and I/O in a sentence or two; supported equipment / configurations; typical applications.' },
  ]},

  { id:'io', title:'Hardware I/O', desc:'Counts per device. Leave 0 if not needed.', fields:[
    { key:'io.relays', label:'Relay outputs', type:'number', unit:'qty' },
    { key:'io.relay_rating', label:'Relay rating', type:'text', hint:'e.g. 2 A @ 24 VAC', showIf:{k:'io.relays', gt:0} },
    { key:'io.analog_outputs', label:'Analog outputs', type:'number', unit:'qty' },
    { key:'io.ao_types', label:'Analog output signal types', type:'multi', options:O(['0-10v','0–10 V'],['2-10v','2–10 V'],['4-20ma','4–20 mA'],['pwm','PWM']), showIf:{k:'io.analog_outputs', gt:0} },
    { key:'io.analog_inputs', label:'Analog inputs', type:'number', unit:'qty' },
    { key:'io.ai_types', label:'Analog input signal types', type:'multi', options:O(['0-10v','0–10 V'],['4-20ma','4–20 mA'],['thermistor','Thermistor'],['rtd','RTD']), showIf:{k:'io.analog_inputs', gt:0} },
    { key:'io.universal_inputs', label:'Universal inputs', type:'number', unit:'qty' },
    { key:'io.ui_types', label:'Universal input combinations supported', type:'multi', options:O(['thermistor_10k','10K thermistor'],['0-10v','0–10 V'],['4-20ma','4–20 mA'],['dry_contact','Dry contact'],['pulse','Pulse / counter'],['resistance','Resistance']), showIf:{k:'io.universal_inputs', gt:0} },
    { key:'io.digital_inputs', label:'Digital / binary inputs', type:'number', unit:'qty' },
    { key:'io.power', label:'Power supply', type:'multi', options:O(['24vac','24 VAC'],['24vdc','24 VDC'],['line','Line voltage'],['poe','PoE'],['battery','Battery']) },
    { key:'io.other', label:'Other I/O or notes', type:'textarea', wide:true },
  ]},

  { id:'sensing', title:'On-board sensing', desc:'Sensors built into the device.', fields:[
    { key:'sensing.onboard', label:'On-board sensors', type:'multi', wide:true, options:O(['temp','Temperature'],['humidity','Humidity'],['co2','CO₂'],['voc','VOC'],['pm','PM2.5'],['pir','PIR / occupancy'],['light','Ambient light'],['sound','Sound'],['pressure','Pressure']) },
    { key:'sensing.external', label:'External / remote sensors to support', type:'textarea', wide:true },
  ]},

  { id:'comms', title:'Communication & protocols', desc:'Pick interfaces first; protocol questions open under each one.', fields:[
    { key:'comms.interfaces', label:'Communication interfaces', type:'multi', wide:true, options:O(['rs485','RS-485'],['ethernet','Ethernet'],['rf','RF'],['ble','Bluetooth LE'],['nfc','NFC'],['wifi','Wi-Fi'],['usb','USB'],['other','Other']) },

    { key:'comms.rs485.ports', label:'RS-485 · number of ports', type:'number', sub:true, showIf:{k:'comms.interfaces', has:'rs485'} },
    { key:'comms.rs485.protocols', label:'RS-485 · protocols', type:'multi', sub:true, options:O(['modbus_rtu','Modbus RTU'],['bacnet_mstp','BACnet MS/TP'],['other','Other']), showIf:{k:'comms.interfaces', has:'rs485'} },
    { key:'comms.rs485.modbus_role', label:'Modbus RTU · role', type:'select', sub:true, options:O(['client','Client (master)'],['server','Server (slave)'],['both','Both']), showIf:[{k:'comms.interfaces', has:'rs485'},{k:'comms.rs485.protocols', has:'modbus_rtu'}] },
    { key:'comms.rs485.other', label:'RS-485 · other protocol', type:'text', sub:true, showIf:[{k:'comms.interfaces', has:'rs485'},{k:'comms.rs485.protocols', has:'other'}] },

    { key:'comms.ethernet.protocols', label:'Ethernet · protocols', type:'multi', sub:true, options:O(['modbus_tcp','Modbus TCP/IP'],['bacnet_ip','BACnet/IP'],['bacnet_sc','BACnet/SC (secure)'],['other','Other']), showIf:{k:'comms.interfaces', has:'ethernet'} },
    { key:'comms.ethernet.ports', label:'Ethernet · number of ports', type:'number', sub:true, showIf:{k:'comms.interfaces', has:'ethernet'} },
    { key:'comms.ethernet.other', label:'Ethernet · other protocol', type:'text', sub:true, showIf:[{k:'comms.interfaces', has:'ethernet'},{k:'comms.ethernet.protocols', has:'other'}] },

    { key:'comms.rf.links', label:'RF · connects to', type:'multi', sub:true, options:O(['ccu','CCU'],['peer','Other field devices'],['sensors','Wireless sensors'],['tbd','TBD']), showIf:{k:'comms.interfaces', has:'rf'} },
    { key:'comms.rf.notes', label:'RF · band / stack notes', type:'text', sub:true, showIf:{k:'comms.interfaces', has:'rf'} },

    { key:'comms.ble.uses', label:'BLE · used for', type:'multi', sub:true, options:O(['commissioning','Commissioning / setup app'],['config','Configuration'],['ota','Firmware update (OTA)'],['sensor','Sensor link'],['external','Interface to external systems']), showIf:{k:'comms.interfaces', has:'ble'} },
    { key:'comms.ble.encryption', label:'BLE · encrypted link to the outside world?', type:'ynt', sub:true, showIf:{k:'comms.interfaces', has:'ble'} },

    { key:'comms.nfc.uses', label:'NFC · used for', type:'multi', sub:true, options:O(['commissioning','Commissioning / setup'],['config','Configuration'],['identify','Tap to identify']), showIf:{k:'comms.interfaces', has:'nfc'} },

    { key:'comms.wifi.protocols', label:'Wi-Fi · protocols', type:'multi', sub:true, options:O(['modbus_tcp','Modbus TCP/IP'],['bacnet_ip','BACnet/IP'],['bacnet_sc','BACnet/SC (secure)'],['mqtt','MQTT'],['other','Other']), showIf:{k:'comms.interfaces', has:'wifi'} },

    { key:'comms.usb.uses', label:'USB · used for', type:'multi', sub:true, options:O(['service','Service / debug'],['ota','Firmware update'],['power','Power']), showIf:{k:'comms.interfaces', has:'usb'} },
    { key:'comms.other', label:'Other interface', type:'text', sub:true, showIf:{k:'comms.interfaces', has:'other'} },
  ]},

  { id:'display', title:'Display & user interface', desc:'Sensors usually have no display — pick "None" if so.', fields:[
    { key:'ui.display', label:'Display type', type:'select', options:O(['none','None'],['led','LED indicators only'],['segment','Segment LCD'],['tft','TFT LCD'],['oled','OLED'],['epaper','E-paper'],['tbd','TBD']) },
    { key:'ui.size', label:'Preferred display size', type:'number', unit:'inches', showIf:{k:'ui.display', in:['segment','tft','oled','epaper']} },
    { key:'ui.orientation', label:'Orientation', type:'select', options:O(['portrait','Portrait'],['landscape','Landscape'],['square','Square / round'],['tbd','TBD']), showIf:{k:'ui.display', in:['segment','tft','oled','epaper']} },
    { key:'ui.input', label:'User input', type:'multi', options:O(['touchscreen','Touchscreen'],['cap_buttons','Capacitive buttons'],['buttons','Physical buttons'],['knob','Rotary knob'],['none','None']) },
    { key:'ui.notes', label:'Screen / UX notes', type:'textarea', wide:true, hint:'Key screens, branding, languages, units.' },
  ]},

  { id:'mech', title:'Form factor & mechanical', desc:'Reuse existing plastics where possible.', fields:[
    { key:'mech.reuse', label:'Reuse an existing product family\'s plastics?', type:'ynt' },
    { key:'mech.family', label:'Product family to reuse', type:'select', options:'@families', showIf:{k:'mech.reuse', eq:'yes'} },
    { key:'mech.enclosure', label:'Describe enclosure requirements', type:'textarea', wide:true, hint:'Size, shape, look — anything known so far.', showIf:{k:'mech.reuse', in:['no','tbd']} },
    { key:'mech.mounting', label:'Mounting', type:'multi', wide:true, options:O(['wall_box','Wall (back box)'],['wall_surface','Wall (surface)'],['din','DIN rail'],['duct','Duct'],['ceiling','Ceiling'],['panel','Panel / enclosure'],['other','Other']) },
    { key:'mech.dimensions', label:'Max dimensions', type:'text', hint:'W × H × D mm' },
    { key:'mech.ip', label:'Ingress protection', type:'text', hint:'e.g. IP20, IP54' },
    { key:'mech.cad', label:'Mechanical / CAD file link', type:'text', wide:true, hint:'Link to the mechanical model, used later for the visual mock-up.' },
  ]},

  { id:'cert', title:'Certification & compliance', desc:'', fields:[
    { key:'cert.list', label:'Certifications required', type:'multi', wide:true, options:O(['ul','UL'],['fcc','FCC'],['ic','ISED (Canada)'],['ce','CE'],['ukca','UKCA'],['btl','BTL (BACnet)'],['rohs','RoHS'],['reach','REACH'],['bis','BIS (India)'],['tbd','TBD']) },
    { key:'cert.other', label:'Other certifications / standards', type:'text', wide:true },
  ]},

  { id:'firmware', title:'Firmware: operation & profiles', desc:'Hardware and firmware are captured together in this one sheet.', fields:[
    { key:'fw.operation', label:'Operating mode', type:'multi', wide:true, options:O(['standalone','Standalone application'],['ccu','Connected to CCU'],['failsafe','Failsafe-only standalone (when CCU is lost)'],['bms','Integrated with BMS']) },
    { key:'fw.profiles', label:'Profiles to support', type:'multi', wide:true, options:O(['2pipe','2-pipe FCU'],['4pipe','4-pipe FCU'],['cpu','Conventional package unit'],['hpu','Heat pump unit'],['uv2','Unit ventilator 2-pipe (economizer)'],['uv4','Unit ventilator 4-pipe (economizer)'],['vav','VAV'],['monitor','Monitoring only'],['other','Other']) },
    { key:'fw.profiles_other', label:'Other profiles', type:'text', wide:true, showIf:{k:'fw.profiles', has:'other'} },
    { key:'fw.profile_std', label:'Standard profiles, or exceptions needed?', type:'select', options:O(['standard','Standard as-is'],['exceptions','Exceptions needed'],['tbd','TBD']) },
    { key:'fw.profile_exceptions', label:'Describe the exceptions', type:'textarea', wide:true, showIf:{k:'fw.profile_std', eq:'exceptions'} },
  ]},

  { id:'features', title:'Firmware: features', desc:'Yes/no for each capability. Add more rows below as features are agreed.', fields:[
    { key:'feat.scheduling', label:'Scheduling', type:'multi', wide:true, options:O(['none','Not needed'],['standalone','Standalone (on device)'],['ccu','Via CCU'],['bacnet','Via BACnet']) },
    { key:'feat.ota', label:'Firmware update (OTA)', type:'multi', wide:true, options:O(['none','Not needed'],['rf','Via RF'],['ble','Via Bluetooth'],['ip','Via Ethernet / IP'],['usb','Via USB / local']) },
    { key:'feat.lowcode', label:'Low-code (Site Sequencer) support', type:'ynt' },
    { key:'feat.lowcode_notes', label:'Low-code notes', type:'text', showIf:{k:'feat.lowcode', eq:'yes'} },
    { key:'feat.custom', label:'Additional features', type:'features', wide:true, hint:'Name each capability and whether it is required.' },
  ]},

  { id:'mockup', title:'Visual mock-up', phase:'Preview later phase', desc:'Captured now; a rendered virtual product from this spec plus the mechanical file comes in a later phase.', fields:[
    { key:'mock.wanted', label:'Generate a visual mock-up from this spec?', type:'ynt' },
    { key:'mock.refs', label:'Reference images / links', type:'textarea', wide:true },
  ]},

  { id:'boq', title:'BOQ & cost estimate', phase:'Costing later phase', desc:'Once the BOQ list is loaded, the tool will estimate cost and list the parts each requirement pulls in.', fields:[
    { key:'boq.wanted', label:'Estimate cost from the BOQ?', type:'ynt' },
    { key:'boq.detail', label:'Level of detail', type:'select', options:O(['summary','Summary (approx. cost + key parts)'],['detailed','Detailed breakdown']), showIf:{k:'boq.wanted', eq:'yes'} },
    { key:'boq.notes', label:'Costing notes', type:'textarea', wide:true, hint:'Known parts, preferred suppliers, cost constraints.' },
  ]},

  { id:'mapping', title:'Existing product match', phase:'Matching phase 2', desc:'Phase 2 will compare this spec with existing products and say whether one already fits (with extra profile engineering) or a new product is needed.', fields:[
    { key:'map.similar', label:'Products you think are close', type:'multi', wide:true, options:'@families' },
    { key:'map.notes', label:'Why existing products don\'t fit', type:'textarea', wide:true },
  ]},

  { id:'notes', title:'Open questions & notes', desc:'', fields:[
    { key:'notes.open', label:'Open questions', type:'textarea', wide:true },
    { key:'notes.other', label:'Other notes', type:'textarea', wide:true },
  ]},
];

/* ---- Profile sections: one per profile in PROFILES (profiles.js), shown when that profile is selected ---- */
const FEATURE_CHOICES = [{v:'std', l:'Standard'}, {v:'chg', l:'Changed'}, {v:'no', l:'Not needed'}];
(function addProfileSections(){
  const at = SECTIONS.findIndex(s => s.id === 'firmware') + 1;
  const extra = Object.entries(PROFILES).map(([pid, p]) => {
    const when = {k:'fw.profiles', has:pid};
    const fields = [];
    for (const f of profileFeatures(pid)){
      fields.push({ key:`prof.${pid}.${f.id}`, label:f.name, type:'feature', options:FEATURE_CHOICES, wide:true,
        group:f.group, profile:pid, feature:f.id, showIf:when });
      fields.push({ key:`prof.${pid}.${f.id}.notes`, label:`${f.name}: what changes?`, type:'textarea', wide:true, sub:true,
        showIf:[when, {k:`prof.${pid}.${f.id}`, eq:'chg'}] });
    }
    fields.push({ key:`prof.${pid}.other`, label:`Other ${p.name} changes or additions`, type:'textarea', wide:true, showIf:when });
    return { id:`profile_${pid}`, title:`Profile: ${p.name}`, profile:pid,
      desc:`Shown because ${p.name} is selected. Each feature defaults to Standard; mark only what changes or isn't needed.`, fields };
  });
  SECTIONS.splice(at, 0, ...extra);
})();
