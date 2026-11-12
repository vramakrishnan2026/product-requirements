/* Profile library: reusable control features shared by profiles, and the
   profiles that use them. Inlined into the page and the Worker by build.mjs.

   FEATURES[id] = { name, group, behaviour: [lines], tuners: [[name, default]], confirm: [lines] }
     - behaviour: the standard behaviour, written so other profiles/products can reuse it
     - confirm:   items copied as written from the source that still need a decision
   PROFILES[id] = { name, summary, typicalIO, ports, options, features: [id | {id, behaviour?, tuners?, confirm?}] }
     - a feature entry can add profile-specific lines / tuner defaults (merged over the shared feature)
   The profile id must match an option value of fw.profiles in form.js. */

const FEATURE_GROUPS = ['Control & setpoints', 'Modes', 'Water side', 'Fan', 'Electric heat', 'Ventilation', 'Inputs & protection', 'Configuration'];

const FEATURES = {
  /* ---- Control & setpoints ---- */
  zone_load_pi: { name: 'Zone load and PI loops', group: 'Control & setpoints',
    behaviour: [
      'Deadbands are used only by the scheduler to set the cooling and heating desired temperatures; zone load calculations do not use them.',
      'Cooling load = current temp − cooling desired temp when current > cooling desired, otherwise 0.',
      'Heating load = heating desired temp − current temp when current < heating desired, otherwise 0.',
      'Cooling loop output = PI(current temp, cooling desired temp) when current > cooling desired, otherwise 0 (0–100%).',
      'Heating loop output = PI(current temp, heating desired temp) when current < heating desired, otherwise 0 (0–100%).',
      'Loop outputs are mapped to the configured staged digital outputs or modulating analog signals.'],
    tuners: [['coolingDeadband', '2 °F'], ['heatingDeadband', '2 °F'], ['temperatureProportionalRange', '2 °F'], ['temperatureIntegralTime', '30 min'], ['proportionalKFactor', '0.5'], ['integralKFactor', '0.5']] },

  pi_hold: { name: 'Keep PI loops when outputs are forced off', group: 'Control & setpoints',
    behaviour: ['When outputs must be switched off (condensate, door/window, etc.) only the ports are switched off; PI loops are never reset, so control resumes from the previous loop value once the condition clears.'] },

  user_intent: { name: 'User intent and setpoint limits', group: 'Control & setpoints',
    behaviour: [
      'User intent: current temperature, zone cooling and heating target temperatures (affected by the schedule), schedule and vacation as in other zones.'],
    tuners: [['maxHeatingUserTemp', '72 °F'], ['minHeatingUserTemp', '67 °F'], ['maxCoolingUserTemp', '77 °F'], ['minCoolingUserTemp', '72 °F']] },

  occupancy: { name: 'Auto-away and auto forced-occupied', group: 'Control & setpoints',
    behaviour: [
      'Auto-away and auto forced-occupied can each be disabled in configuration; all algorithm operations follow the setting.',
      'Forced occupied lasts forcedOccupiedTime; auto-away applies the setback after autoAwayTime.'],
    tuners: [['forcedOccupiedTime', '120 min'], ['autoAwayTime', '30 min'], ['autoAwayZoneSetbackTemp', '2 °F']] },

  zone_switchover: { name: 'Auto changeover with built-in hysteresis', group: 'Control & setpoints',
    behaviour: [
      'In Auto, once in heating the unit stays in heating operation mode as temperature rises through the deadband, and only switches to cooling when the current temperature exceeds the cooling desired temperature (and vice versa).',
      'No changeover happens inside the deadband, which prevents relay chattering.'] },

  /* ---- Modes ---- */
  cond_modes: { name: 'Conditioning modes', group: 'Modes',
    behaviour: [
      'User can choose Off / Auto / Heat only / Cool only, limited to what the configuration supports.',
      'Off: normal operation stops; all digital outputs and thermal valves (heating, cooling, fan) are off and analog outputs go to their minimum.',
      'RE 2020 modes: Comfort (user-defined temperature from zone or device), Economy (setback temperatures), Freeze protection (emergency conditioning), Off.'] },

  fan_off: { name: 'Fan mode Off', group: 'Modes',
    behaviour: [
      'Fan Off from the CCU or portals/apps stops normal operation: digital outputs and thermal valves off, analog outputs at minimum.',
      'Water sampling continues while the fan is off; air sampling is not done.',
      'Conditioning / fan mode vs sampling: Off/Off → no water or air sampling; Off/On → air sampling only; On/Off → water sampling only.'] },

  /* ---- Water side ---- */
  water_mode_detect: { name: 'Heating/cooling detection from supply water', group: 'Water side',
    behaviour: [
      'Supply water temperature above the Fancoil Heating Threshold → heating operation; below the Fancoil Cooling Threshold → cooling operation.',
      'Alternatively a changeover sensor (N/O or N/C) decides the operation. If both are mapped the changeover sensor has priority and the user is told so in a pop-up; a second changeover sensor cannot be mapped.'],
    tuners: [['Fancoil Heating Threshold', '85 °F'], ['Fancoil Cooling Threshold', '65 °F']],
    confirm: ['Supply water temperature is listed as "mandatorily enabled", while the changeover sensor is described as an alternative.'] },

  valve_onoff: { name: 'Water valve on/off (relay)', group: 'Water side',
    behaviour: [
      'With the fan not off: the valve relay turns on when the loop output > relayActivationHysteresis and off when the loop output = 0.',
      'With the fan off: the valve relay is deactivated.'] },

  valve_modulating: { name: 'Modulating water valve (analog)', group: 'Water side',
    behaviour: [
      'The valve signal modulates between analogOutXAtMin… and analogOutXAtMax… as the loop output goes 0–100%.',
      'Reverse acting is allowed: max may be lower than min (e.g. 10 V = closed, 2 V = fully open).',
      'Min and max are configurable 0–10 V in 1 V steps.'] },

  thermal_valve_pwm: { name: 'Thermal valve PWM', group: 'Water side',
    behaviour: [
      'Thermal actuators use PWM only (no plain on/off).',
      'thermalValveOpeningTime (time to open 0→100%) is applied at the start of a load request.',
      'With a 20 s time base: 100% load → valve on every cycle; 50% load → 10 s on, 10 s off.',
      'During water sampling the valve opens for the opening time and is then held open for the sampling on-time; if zone load appears during sampling, it switches to PWM starting with the on-time.'],
    tuners: [['thermalValvePWMtimeBase', '20 s'], ['thermalValveOpeningTime', '3 min']],
    confirm: ['A second section names the tuners thermalValveOnTime and thermalValveWaitTime instead.'] },

  water_sampling: { name: 'Water sampling', group: 'Water side',
    behaviour: [
      'Mode known (water above heating threshold or below cooling threshold) and loop > 0: if the valve has not been on for waterValveSamplingWaitTime, open it for waterValveSamplingOnTime so the reading is not of stagnant water.',
      'Mode not known (water between the thresholds): if the valve has not been on for waterValveSamplingDuringLoopDeadbandWaitTime, open it for waterValveSamplingDuringLoopDeadbandOnTime so enough water flows to decide the mode.',
      'No sampling while the zone is in deadband (loop = 0); the valve is off.',
      'Either water sampling or a changeover sensor determines the operation.'],
    tuners: [['waterValveSamplingWaitTime', '58 min'], ['waterValveSamplingOnTime', '2 min'], ['waterValveSamplingDuringLoopDeadbandWaitTime', '5 min'], ['waterValveSamplingDuringLoopDeadbandOnTime', '2 min']],
    confirm: ['Condition written as "loop output > 0 and loop is less than relayActivationHysteresis" in one place and "within relayActivationHysteresis" in another.',
      'Sync notes say this is not testable and was not included in the firmware; suggestion was to set error to 5 and verify.'] },

  air_sampling: { name: 'Air sampling (return air sensor)', group: 'Water side',
    behaviour: [
      'Available only when a return air temperature sensor is mapped; enabled by a toggle (in firmware, always done when on).',
      'When the supply water is between the heating and cooling thresholds (deadband) and the fan has not run for AirSamplingWaitTime, run it for AirSamplingOnTime: lowest mapped relay speed, or Analog at Recirc for an analog fan. With fan Auto, the lowest speed is used.',
      'When mapped, the return air sensor replaces the current temperature sensor for zone load and is shown on the device screen.'],
    tuners: [['AirSamplingWaitTime', '30 min'], ['AirSamplingOnTime', '1 min']] },

  /* ---- Fan ---- */
  fan_staging: { name: 'Staged fan (relays)', group: 'Fan',
    behaviour: [
      'Stages: low-ventilation, low, medium, high; only one fan digital output is on at a time.',
      'Fan loop output = cooling (or heating) loop output × analogFanSpeedMultiplier, capped at 100%.',
      '3 stages: Low on when fan loop > relayActivationHysteresis, off at 0; Medium on above 33% + H/2, off at ≤ 33% − H/2; High on above 66% + H/2, off at ≤ 66% − H/2.',
      'Flexible stages: the highest stage mapped sets the number of stages (e.g. only High mapped → it turns on above 66% + H).',
      'Low-ventilation: on when fan loop = 0 during the occupied schedule and when fan loop > 0 when unoccupied; with Medium/High mapped it runs up to 33% + H/2.',
      'Stage transitions depend on the active stage, not on the loop direction: step up above threshold + H/2, step down below threshold − H/2, otherwise hold (e.g. 3 stages, 20% H: Medium→High above 76, High→Medium below 56, Low→Medium above 43, Medium→Low below 23). Applies to all devices; existing stage up/down timers stay on top.'],
    tuners: [['relayActivationHysteresis', '10%'], ['analogFanSpeedMultiplier', '1']],
    confirm: ['Low stage turn-on is written as "> relayActivationHysteresis", while the electric-heat examples and the "same behaviour at loop start" requirement use H/2.'] },

  fan_analog: { name: 'Analog fan speed (EC fan)', group: 'Fan',
    behaviour: [
      'Fan signal modulates between analogOutXAtMinFan and analogOutXAtMaxFan as the fan loop goes 0–100%.',
      'For manual Low/Medium/High selections the output is set to a % of (max − min): analogOutXAtFanLow / Medium / High.',
      'With the fan on an analog output, all fan mode options are offered.'] },

  fan_modes: { name: 'Fan modes (user intent)', group: 'Fan',
    behaviour: [
      'Auto: fan runs whenever heating or cooling occurs, following the fan stages / fan loop.',
      'For each mapped speed (Low, Medium, High): Current occupied period (on until the end of the current occupied time, then back to Auto), Occupied period (on during scheduled occupied time every day, back to Auto at the end), All times (always on).',
      'Options offered depend on the speeds mapped; a higher speed can be mapped without lower ones. Analog fan uses analogOutXAtFanLow/Medium/High for the fixed speeds.'] },

  fan_enable: { name: 'Fan enable and occupied enable outputs', group: 'Fan',
    behaviour: [
      'Fan enable: output on whenever the zone is occupied, and also when conditioning during the unoccupied schedule.',
      'Occupied enable: output on during the occupied schedule only, not when conditioning while unoccupied.'] },

  min_fan_runtime: { name: 'Minimum fan run time after conditioning', group: 'Fan',
    behaviour: [
      'When a water valve or the electric heat turns off (in occupied, or on the transition to unoccupied), the fan keeps running at the last speed for minFanRuntimePostConditioning; an analog fan runs at Analog at Recirc.',
      'Also applies when the user turns the electric heater off.'],
    tuners: [['minFanRuntimePostConditioning', '5 min']] },

  analog_recirc: { name: 'Analog at Recirc', group: 'Fan',
    behaviour: [
      'When the cooling and heating loops are zero and the fan is on an analog output, the fan runs at Analog at Recirc (sent to the device in volts).',
      'Moving from recirculation to load, the PI-driven signal starts from Analog at Min (e.g. 4 V in deadband, then scales up from 2 V).'],
    tuners: [['Analog at Recirc', '4 V']] },

  /* ---- Electric heat ---- */
  aux_heat: { name: 'Electric heat as auxiliary heat', group: 'Electric heat',
    behaviour: [
      'Used when hot water is available.',
      'On when current temp < heating desired temp − auxHeatingActivate.',
      'Electric heat never runs without the fan.'],
    tuners: [['auxHeatingActivate', '3 °F (absolute; same number for °F and °C)']],
    confirm: ['Off point written two ways: OFF = CT > (HDT − auxHeatingActivate − 1) gives 66 °F at 70 °F setpoint, but the worked example and the later formula (HDT − (auxHeatingActivate − 1)) give 68 °F.'] },

  eh_pwm: { name: 'Electric heat PWM (primary heat)', group: 'Electric heat',
    behaviour: [
      'Used as the primary heat source when hot water is not available (supply water in deadband or cooling).',
      'Relay cycles on a 2 min time base (AuxHeatingCycleTime) in proportion to the heating loop, starting at loop = H/2 (e.g. 25% → 30 s on / 90 s off; 39% → 46.8 s; 72% → 86.4 s; 100% → continuously on).',
      'Fan Auto: highest mapped fan speed runs with the heater.',
      'Fixed fan speeds set the duty cycle: Low = AuxHeatingDutyCycleLow, Medium = …Medium, High = …High of the cycle time.'],
    tuners: [['AuxHeatingCycleTime', '2 min'], ['AuxHeatingDutyCycleLow', '25%'], ['AuxHeatingDutyCycleMedium', '50%'], ['AuxHeatingDutyCycleHigh', '100%']] },

  /* ---- Ventilation ---- */
  fa_damper: { name: 'Fresh-air damper (relay)', group: 'Ventilation',
    behaviour: [
      'Sets the minimum outside-air damper position. When zone CO₂ > CO₂ threshold and the zone is occupied or forced occupied: FAD loop = (zone CO₂ − threshold) / damper opening rate.',
      'FAD loop = 0 when CO₂ < threshold, unoccupied or pre-conditioning. The relay turns on when the FAD loop > relayActivationHysteresis.'] },

  dcv_damper: { name: 'DCV modulating damper (analog)', group: 'Ventilation',
    behaviour: [
      'Signal modulates between analogOutXAtMinDCVDamper and …Max as zone CO₂ rises above the threshold: DCV loop = (zone CO₂ − threshold) / damper opening rate; 0 when below threshold, unoccupied or pre-conditioning.',
      'Display labels: CO₂ target → "Alert Ovr", CO₂ damper opening rate → "Damp Full opn", CO₂ threshold → "Damp Start opn".'] },

  humidity: { name: 'Humidifier / dehumidifier outputs', group: 'Ventilation',
    behaviour: ['Humidifier and dehumidifier follow the standard humidity logic.'],
    tuners: [['humidityHysteresis', '5%']],
    confirm: ['Listed only in some output option lists; behaviour is not described in the profile.'] },

  /* ---- Inputs & protection ---- */
  ui_types: { name: 'Universal input types', group: 'Inputs & protection',
    behaviour: [
      'Current TX 0–10 / 0–20 / 0–50 A (0–10 V) — monitoring.',
      'Supply air, return air, supply water temperature — thermistor, −58 to 302 °F (NTC type 2). Return air is used for air sampling.',
      'CO₂ — 0–2000 ppm on 0–10 V — DCV.',
      'Fresh-air damper feedback — 0–100% on 0–10 V — monitoring.',
      'Dry contacts (N/O and N/C, threshold 10 kΩ): condensate overflow, door/window (Title 24 and normal), key card, generic alarm (monitoring), changeover.'] },

  condensate: { name: 'Condensate overflow protection', group: 'Inputs & protection',
    behaviour: ['When condensate overflow is detected, cooling, heating and fan outputs on relays/thermal valves are off and analog outputs are at minimum.'] },

  door_window: { name: 'Door/window sensor', group: 'Inputs & protection',
    behaviour: [
      'Title 24 type: lowest mapped fan speed keeps running (analog fan at Analog at Recirc).',
      'Normal type: all relays off, analog outputs at minimum.',
      'A Title 24 and a normal door/window sensor of the same contact type cannot both be mapped.'] },

  key_card: { name: 'Key card sensor', group: 'Inputs & protection',
    behaviour: [
      'Card in slot (occupant present): if unoccupied, the zone goes to forced occupied and the desired temperature changes.',
      'Card out of slot: if occupied, the zone goes to key-card auto-away using the auto-away setback.',
      'Key card has priority over the occupancy sensor.'] },

  priority: { name: 'Safety and input priority', group: 'Inputs & protection',
    behaviour: [
      'Overall priority: Emergency shutoff > Freezestat > Door/window (Title 24) > Door/window > Condensate overflow > User intents.',
      'Universal-input functions: Conditioning mode Off > Condensate overflow > Door/window (Title 24) > Door/window > Key card.'] },

  building_limits: { name: 'Sensor validity against building limits', group: 'Inputs & protection',
    behaviour: ['Building limits decide whether temperatures reported by the sensors are valid.'],
    confirm: ['Source text (16 Oct addition) is incomplete.'] },

  /* ---- Configuration ---- */
  default_config: { name: 'Default configuration on pairing', group: 'Configuration',
    behaviour: [
      'On first pairing the CCU loads the default configuration from the .ini file and shows it on the configuration page.',
      'Changes made on the CCU are saved and sent to the device.'] },
};

const PROFILES = {
  '2pipe': {
    name: '2-pipe FCU',
    summary: 'One coil supplied with either chilled or hot water by the central plant. The controller decides heating or cooling operation from the supply water temperature (or a changeover sensor) and controls the fan speed and the water valve.',
    typicalIO: 'Relays 3 + 1 (electric heat), thermal valves 2, analog outputs 4, universal inputs 6, sensor option PoR',
    ports: [['Electric heat', 'Aux heating'], ['Digital out 1', 'Fan low speed'], ['Digital out 2', 'Fan medium speed'], ['Digital out 3', 'Fan high speed'],
      ['Thermal valve 1', 'Water valve'], ['Thermal valve 2', 'Water valve'], ['Analog out 1', 'Fan speed'], ['Analog out 2', 'Water modulating valve'],
      ['Analog out 3', 'Externally mapped – not used'], ['Analog out 4', 'FA modulating damper'], ['Thermistor input 1', 'Return air temperature (mandatory)'],
      ['Universal input 2', 'Supply air temperature'], ['Universal input 3', 'Supply water temperature (mandatory)'], ['Universal input 4', 'CO₂ sensor / door-window sensor'],
      ['Universal input 5', 'Fresh-air damper feedback / CO₂ sensor'], ['Universal input 6', 'Condensate overflow N/C']],
    options: [
      ['Digital outputs', 'Fan low speed – ventilation, Fan low, Fan medium, Fan high, Water valve, Fan enable, Occupied enable, FA damper, Humidifier, Dehumidifier, Externally mapped'],
      ['Analog outputs', 'Water modulating valve, Fan speed, FA / DCV modulating damper, Externally mapped'],
      ['Universal inputs', 'Current TX (0–10, 0–20, 0–50 A), Supply water temp, Supply air temp, Return air temp, CO₂, Condensate overflow N/O & N/C, Fresh-air damper feedback, Door/window Title 24 N/O & N/C, Door/window N/O & N/C, Key card N/O & N/C, Generic alarm N/O & N/C, Changeover N/O & N/C']],
    features: [
      'zone_load_pi', 'pi_hold', 'user_intent', 'occupancy', 'zone_switchover',
      'cond_modes', 'fan_off',
      'water_mode_detect', 'valve_onoff', { id: 'valve_modulating', tuners: [['analogOutXAtMinWaterValve', '0 V'], ['analogOutXAtMaxWaterValve', '10 V']] },
      'thermal_valve_pwm', 'water_sampling', 'air_sampling',
      'fan_staging', { id: 'fan_analog', tuners: [['analogOutXAtMinFan', '0 V'], ['analogOutXAtMaxFan', '10 V'], ['analogOutXAtFanLow', '70%'], ['analogOutXAtFanMedium', '80%'], ['analogOutXAtFanHigh', '100%']] },
      'fan_modes', 'fan_enable', { id: 'min_fan_runtime', confirm: ['Text also says 2 minutes in places.'] },
      { id: 'analog_recirc', confirm: ['Default written as "4V 2V".'] },
      { id: 'aux_heat', behaviour: ['In heating or cooling operation with Auto fan, the highest mapped fan speed runs while the electric heat is on (High, else Medium, else Low).', 'Electric heat and the water valve relay are off when the fan is off.'] },
      'eh_pwm',
      'fa_damper', { id: 'dcv_damper', tuners: [['analogOutXAtMinDCVDamper', '0 V'], ['analogOutXAtMaxDCVDamper', '10 V']] }, 'humidity',
      'ui_types', 'condensate', 'door_window', 'key_card', 'priority', 'building_limits',
      'default_config'],
  },

  '4pipe': {
    name: '4-pipe FCU',
    summary: 'Separate heating and cooling coils, each with its own supply. The controller controls the fan speed and which coil valve opens.',
    typicalIO: 'Relays 3 + 1 (electric heat), thermal valves 2, analog outputs 4, universal inputs 6, sensor option PoR',
    ports: [['Electric heat', 'Aux heating'], ['Digital out 1', 'Fan low speed'], ['Digital out 2', 'Fan medium speed'], ['Digital out 3', 'Fan high speed'],
      ['Thermal valve 1', 'Cooling water valve'], ['Thermal valve 2', 'Heating water valve'], ['Analog out 1', 'Fan speed'], ['Analog out 2', 'Cooling modulating valve'],
      ['Analog out 3', 'Heating modulating valve'], ['Analog out 4', 'FA modulating damper'], ['Thermistor input 1', 'Return air temperature (mandatory)'],
      ['Universal input 2', 'Supply air temperature'], ['Universal input 3', 'Supply water temperature'], ['Universal input 4', 'CO₂ sensor / door-window sensor'],
      ['Universal input 5', 'Fresh-air damper feedback / CO₂ sensor'], ['Universal input 6', 'Condensate overflow']],
    options: [
      ['Digital outputs', 'Fan low speed – ventilation, Fan low, Fan medium, Fan high, Water valve, Fan enable, Occupied enable, DCV damper, Externally mapped'],
      ['Analog outputs', 'Water modulating valve, Fan speed, DCV modulating damper, Externally mapped'],
      ['Universal inputs', 'Current TX (0–10, 0–20, 0–50 A), Supply water temp, Supply air temp, Return air temp, CO₂, Condensate, Fresh-air damper feedback, Door/window Title 24 N/O & N/C, Door/window N/O & N/C, Key card N/O & N/C, Generic alarm N/O & N/C']],
    features: [
      'zone_load_pi', 'pi_hold', 'user_intent', 'occupancy',
      { id: 'cond_modes', behaviour: ['Modes offered follow the configuration: heating and cooling mapped → Off/Auto/Heat only/Cool only; heating only → Off/Heat only; cooling only → Off/Cool only; cooling + electric heat → all four.'] },
      'fan_off',
      { id: 'valve_onoff', name: 'Cooling and heating valves on/off (relay)', behaviour: ['Cooling valve follows the cooling loop output; heating valve follows the heating loop output.', 'Both valves off (analog valves at minimum) when the fan is off.'] },
      { id: 'valve_modulating', name: 'Modulating cooling and heating valves (analog)', behaviour: ['Cooling valve signal follows the cooling loop; heating valve signal follows the heating loop.'],
        tuners: [['analogOutXAtMinCoolingValve', '2 V'], ['analogOutXAtMaxCoolingValve', '10 V'], ['analogOutXAtMinHeatingValve', '2 V'], ['analogOutXAtMaxHeatingValve', '10 V']] },
      'thermal_valve_pwm', 'air_sampling',
      'fan_staging', { id: 'fan_analog', tuners: [['analogOutXAtMinFan', '2 V'], ['analogOutXAtMaxFan', '10 V'], ['analogOutXAtFanLow', '30%'], ['analogOutXAtFanMedium', '60%'], ['analogOutXAtFanHigh', '100%']] },
      'fan_modes', 'fan_enable', 'min_fan_runtime',
      { id: 'analog_recirc', confirm: ['A "Recirculation" note says analogOutXAtMin (fan) and Analog at Recirc are both fixed at 2 V, while other sections give 4 V as the default.'] },
      { id: 'aux_heat', behaviour: [
          'Both coils configured → electric heat is aux reheat. Heating-only → electric heat is secondary (aux) heat, as on the 2-pipe heating side. Cooling-only → electric heat is the primary heat source (see Electric heat PWM).',
          'Auto fan: Fan medium runs whenever the electric heat is on; if medium is not mapped, the lowest mapped speed or Fan enable. Fixed fan speed: relays follow the user speed and the heat follows its own activation rule.',
          'Electric heat and valves are off when the fan is off.'],
        confirm: ['Worked example says it deactivates "2 °F less than heating desired temp" with the same numbers as 2-pipe.'] },
      { id: 'eh_pwm', behaviour: ['Applies when the 4-pipe unit is configured with the cooling coil only.'] },
      'fa_damper', { id: 'dcv_damper', tuners: [['analogOutXAtMinDCVDamper', '2 V'], ['analogOutXAtMaxDCVDamper', '10 V']] }, 'humidity',
      { id: 'ui_types', confirm: ['Changeover sensor N/O is mapped 0 = Heating, 1 = Cooling here (opposite of 2-pipe), and changeover is missing from the universal-input option list.'] },
      'condensate', 'door_window', 'key_card', 'priority',
      'default_config'],
  },
};

/* Resolve a profile's feature entry: shared feature + profile-specific additions. */
function profileFeature(entry) {
  const e = typeof entry === 'string' ? { id: entry } : entry;
  const base = FEATURES[e.id];
  return {
    id: e.id, name: e.name || base.name, group: base.group,
    behaviour: [...(base.behaviour || []), ...(e.behaviour || [])],
    tuners: e.tuners ? [...(base.tuners || []), ...e.tuners] : (base.tuners || []),
    confirm: [...(base.confirm || []), ...(e.confirm || [])],
  };
}
