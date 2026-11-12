/* Profile library: reusable control features shared by profiles, and the
   profiles that use them. Inlined into the page and the Worker by build.mjs.

   FEATURES[id] = { name, group, behaviour: [lines], tuners: [[name, default]], confirm: [lines] }
     - behaviour: the standard behaviour, written so other profiles/products can reuse it
     - confirm:   items copied as written from the source that still need a decision
   PROFILES[id] = { name, summary, typicalIO, portSets: [{device, ports, options}], features: [id | {id, behaviour?, tuners?, confirm?}] }
     - a feature entry can add profile-specific lines / tuner defaults (merged over the shared feature)
   The profile id must match an option value of fw.profiles in form.js. */

const FEATURE_GROUPS = ['Control & setpoints', 'Modes', 'Staged & modulating conditioning', 'Water side', 'Fan', 'Electric heat', 'Ventilation', 'Inputs & protection', 'Configuration'];

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
      'User intent: current temperature, zone cooling and heating target temperatures (affected by the schedule), schedule and vacation as in other zones.'] },

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
      'Heat only: stays in heating operation; no conditioning whenever the current temperature is above the heating desired temperature. Cool only: stays in cooling; no conditioning whenever the current temperature is below the cooling desired temperature.',
      'RE 2020 modes: Comfort (user-defined temperature from zone or device), Economy (setback temperatures), Freeze protection (emergency conditioning), Off.'] },

  fan_off: { name: 'Fan mode Off', group: 'Modes',
    behaviour: [
      'Fan Off from the CCU or portals/apps stops normal operation: no conditioning; digital outputs and thermal valves off, analog outputs at minimum.'] },

  /* ---- Staged & modulating conditioning ---- */
  staged_conditioning: { name: 'Staged cooling and heating (relays)', group: 'Staged & modulating conditioning',
    behaviour: [
      'The cooling loop output drives the cooling stage relays and the heating loop output drives the heating stage relays.',
      '2 stages: stage 1 on when loop > relayActivationHysteresis, off at loop = 0; stage 2 on above 50% + H/2, off at ≤ 50% − H/2.',
      'Flexible stages: the highest stage mapped sets the number of stages (e.g. only Cooling stage 2 mapped → it turns on above 50% + H).'],
    tuners: [['relayActivationHysteresis', '10%']] },

  analog_conditioning: { name: 'Modulating cooling and heating signals (analog)', group: 'Staged & modulating conditioning',
    behaviour: [
      'Cooling signal modulates between analogOutXAtMinCooling and …Max as the cooling loop goes 0–100%; heating signal likewise with the heating loop.',
      'Reverse acting is allowed (max may be lower than min).',
      'Any analog output can be mapped to cooling, heating or fan; parameter names follow the output number.'],
    tuners: [['analogOutXAtMinCooling', '2 V'], ['analogOutXAtMaxCooling', '10 V'], ['analogOutXAtMinHeating', '2 V'], ['analogOutXAtMaxHeating', '10 V']] },

  compressor_staged: { name: 'Compressor stages (relays)', group: 'Staged & modulating conditioning',
    behaviour: [
      'Compressor stages serve both cooling and heating; they follow the cooling loop or the heating loop, whichever is active.',
      'Stage 1 on when the loop > relayActivationHysteresis, off at loop = 0. Stage 2 on above 50% + H/2.'],
    tuners: [['relayActivationHysteresis', '10%']],
    confirm: ['Stage 2 turn-off is written as "≤ 50% + H/2" (other profiles use 50% − H/2).', 'Compressor stage 3 is offered but its thresholds are not described.'] },

  compressor_modulating: { name: 'Modulating compressor speed (analog)', group: 'Staged & modulating conditioning',
    behaviour: [
      'Compressor signal modulates between analogOutXAtMinCompressor and …Max as the compressor loop goes 0–100%; compressor loop = cooling loop (or heating loop, whichever is active).'],
    tuners: [['analogOutXAtMinCompressor', '2 V'], ['analogOutXAtMaxCompressor', '10 V']] },

  hp_changeover: { name: 'Heat pump changeover relay (O/B)', group: 'Staged & modulating conditioning',
    behaviour: [
      'Type O energizes in cooling (relay on when cooling loop > 0, off in heating); Type B energizes in heating (on when heating loop > 0, off in cooling). Conditioning mode Off → off.',
      'Any relay can be mapped as changeover; default type is O.',
      'The only relay mapped as changeover cannot be disabled from the CCU or portals. If it is mapped to more than one relay (e.g. to work around a damaged relay), any of them can be disabled but not all.'] },

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
      'Options offered depend on the speeds mapped; a higher speed can be mapped without lower ones. Analog fan uses analogOutXAtFanLow/Medium/High for the fixed speeds.',
      'A fan mode other than Auto/Off takes precedence over the PI loop and over aux-heat fan control.'] },

  fan_staged_analog: { name: 'Staged fan speed (analog)', group: 'Fan',
    behaviour: [
      'An analog output mapped to "staged fan" sends a user-set voltage for each cooling or heating stage that is on, instead of following the fan loop (e.g. to drive a VFD in step with the stages).',
      'One voltage per configured stage: FanOutAtCoolStage1…n and FanOutAtHeatStage1…n.',
      'With Fan enable mapped and staged fan configured, the fan runs whenever the fan loop > 0% (not only above relayActivationHysteresis).'],
    tuners: [['FanOutAtCoolStage1', '7 V'], ['FanOutAtCoolStage2', '10 V'], ['FanOutAtCoolStage3', '10 V'], ['FanOutAtHeatStage1', '7 V'], ['FanOutAtHeatStage2', '10 V'], ['FanOutAtHeatStage3', '10 V']] },

  fan_application: { name: 'Residential vs commercial fan operation', group: 'Fan',
    behaviour: [
      'Residential/hotel (no Fan enable relay mapped): fan Auto runs only while a heating or cooling stage runs; Low/High run all the time.',
      'Commercial (Fan enable mapped): stage-1 fan runs whenever the zone is occupied, or on a call for heating/cooling when unoccupied; the user can force stage-1 fan on all the time.',
      'Fan Off: no conditioning.'] },

  fan_enable: { name: 'Fan enable and occupied enable outputs', group: 'Fan',
    behaviour: [
      'Fan enable: output on whenever the zone is occupied, and also when conditioning during the unoccupied schedule.',
      'Occupied enable: output on during the occupied schedule only, not when conditioning while unoccupied.'] },

  min_fan_runtime: { name: 'Minimum fan run time after conditioning', group: 'Fan',
    behaviour: [
      'When conditioning turns off (water valve, electric heat or heating/cooling stages), in occupied or on the transition to unoccupied, the fan keeps running for minFanRuntimePostConditioning so the coil heat is dissipated: relay fan at the last speed; analog fan at Analog at Recirc.',
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

  aux_heat_2stage: { name: 'Two-stage aux heat with fan staging', group: 'Electric heat',
    behaviour: [
      'Aux stage 1 on when current temp < heating desired temp − auxHeating1Activate; aux stage 2 on when current temp < heating desired temp − auxHeating2Activate. Each turns off 1 °F closer to the setpoint than its turn-on point (e.g. 3 °F on → 2 °F off).',
      'Fan Auto: aux stage 1 runs Fan medium (and lower fan relays); aux stage 2 runs Fan high (and lower relays). The analog fan gets the equivalent medium/high value.',
      'If Medium is not mapped: stage 1 uses the lowest mapped speed; with Low and High mapped, Low runs on stage 1 and High (+ Low) on stage 2. With only one fan relay, both stages use it.',
      'Once an aux stage is on, the aux logic drives the fan (relay or analog) instead of the PI loop. Fixed fan modes still take precedence.'],
    tuners: [['auxHeating1Activate', '3 °F'], ['auxHeating2Activate', '4 °F']] },

  /* ---- Ventilation ---- */
  fa_damper: { name: 'Fresh-air damper (relay)', group: 'Ventilation',
    behaviour: [
      'Sets the minimum outside-air damper position. When zone CO₂ > CO₂ threshold and the zone is occupied or forced occupied: FAD loop = (zone CO₂ − threshold) / damper opening rate.',
      'FAD loop = 0 when CO₂ < threshold, unoccupied or pre-conditioning. The relay turns on when the FAD loop > relayActivationHysteresis.'] },

  dcv_damper: { name: 'DCV modulating damper (analog)', group: 'Ventilation',
    behaviour: [
      'Signal modulates between analogOutXAtMinDCVDamper and …Max as zone CO₂ rises above the threshold: DCV loop = (zone CO₂ − threshold) / damper opening rate; 0 when below threshold, unoccupied or pre-conditioning.',
      'Display labels: CO₂ target → "Alert Ovr", CO₂ damper opening rate → "Damp Full opn", CO₂ threshold → "Damp Start opn".'] },

  dcv_relay: { name: 'DCV damper relay', group: 'Ventilation',
    behaviour: [
      'A relay mapped to DCV damper turns on when the DCV loop > CO2damperRelayActivationHysteresis and off when the DCV loop falls to 0%.',
      'The DCV damper relay state is shown in the conditioning status and zone status messages.'],
    tuners: [['CO2damperRelayActivationHysteresis', '10% (range 0–100%)']] },

  humidity: { name: 'Humidifier / dehumidifier outputs', group: 'Ventilation',
    behaviour: [
      'Humidifier: on when zone humidity drops below targetMinInsideHumidity; off once it rises humidityHysteresis above it.',
      'Dehumidifier: on when zone humidity rises above targetMaxInsideHumidity; off once it drops humidityHysteresis below it.',
      'When mapped, the target humidity user intent appears on the CCU zone screen and in the facility apps (dehumidifier target not in the occupant app).'],
    tuners: [['humidityHysteresis', '5%'], ['targetMinInsideHumidity', 'same as system / 25%'], ['targetMaxInsideHumidity', 'same as system / 45%']],
    confirm: ['Second description in the CPU profile reverses the on/off conditions ("on if humidity crosses over the threshold, off 5% below" for the humidifier, and the opposite for the dehumidifier).'] },

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
  temp_offset: { name: 'Temperature offset', group: 'Configuration',
    behaviour: ['Configurable temperature offset for the onboard sensor, −10 °F to +10 °F.'] },

  output_test: { name: 'Output test from configuration', group: 'Configuration',
    behaviour: ['Each enabled relay can be forced on, and each analog output set to a test value (0.0–10.0 V), from the configuration screen to check wiring.'] },

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
    portSets: [{ device: 'TFCU', ports: [['Electric heat', 'Aux heating'], ['Digital out 1', 'Fan low speed'], ['Digital out 2', 'Fan medium speed'], ['Digital out 3', 'Fan high speed'],
      ['Thermal valve 1', 'Water valve'], ['Thermal valve 2', 'Water valve'], ['Analog out 1', 'Fan speed'], ['Analog out 2', 'Water modulating valve'],
      ['Analog out 3', 'Externally mapped – not used'], ['Analog out 4', 'FA modulating damper'], ['Thermistor input 1', 'Return air temperature (mandatory)'],
      ['Universal input 2', 'Supply air temperature'], ['Universal input 3', 'Supply water temperature (mandatory)'], ['Universal input 4', 'CO₂ sensor / door-window sensor'],
      ['Universal input 5', 'Fresh-air damper feedback / CO₂ sensor'], ['Universal input 6', 'Condensate overflow N/C']],
    options: [
      ['Digital outputs', 'Fan low speed – ventilation, Fan low, Fan medium, Fan high, Water valve, Fan enable, Occupied enable, FA damper, Humidifier, Dehumidifier, Externally mapped'],
      ['Analog outputs', 'Water modulating valve, Fan speed, FA / DCV modulating damper, Externally mapped'],
      ['Universal inputs', 'Current TX (0–10, 0–20, 0–50 A), Supply water temp, Supply air temp, Return air temp, CO₂, Condensate overflow N/O & N/C, Fresh-air damper feedback, Door/window Title 24 N/O & N/C, Door/window N/O & N/C, Key card N/O & N/C, Generic alarm N/O & N/C, Changeover N/O & N/C']] },
      { device: 'MyStat', ports: [['Relay 1', 'Water valve'], ['Relay 2', 'Fan low speed'], ['Relay 3', 'Aux heating'], ['Relay 4', 'Fan high speed'], ['Analog out', 'Modulating water valve'], ['Universal input', 'Supply water temperature (always enabled)']],
        options: [['Relays', 'Fan low speed, Fan high speed, Water valve, Aux heating, Fan enable, Occupied enable, Humidifier, Dehumidifier, Externally mapped, DCV damper'],
          ['Analog out', 'Modulating water valve, Fan speed, Externally mapped, DCV damper'], ['Universal input', 'Supply water temperature (always enabled)']] }],
    features: [
      'zone_load_pi', 'pi_hold', { id: 'user_intent', tuners: [['maxHeatingUserTemp', '72 °F'], ['minHeatingUserTemp', '67 °F'], ['maxCoolingUserTemp', '77 °F'], ['minCoolingUserTemp', '72 °F']] }, 'occupancy', 'zone_switchover',
      'cond_modes', { id: 'fan_off', behaviour: ['Water sampling continues while the fan is off; air sampling is not done.', 'Conditioning / fan mode vs sampling: Off/Off → no water or air sampling; Off/On → air sampling only; On/Off → water sampling only.'] },
      'water_mode_detect', 'valve_onoff', { id: 'valve_modulating', tuners: [['analogOutXAtMinWaterValve', '0 V'], ['analogOutXAtMaxWaterValve', '10 V']] },
      'thermal_valve_pwm', 'water_sampling', 'air_sampling',
      'fan_staging', { id: 'fan_analog', tuners: [['analogOutXAtMinFan', '0 V'], ['analogOutXAtMaxFan', '10 V'], ['analogOutXAtFanLow', '70%'], ['analogOutXAtFanMedium', '80%'], ['analogOutXAtFanHigh', '100%']] },
      'fan_modes', 'fan_enable', { id: 'min_fan_runtime', confirm: ['Text also says 2 minutes in places.'] },
      { id: 'analog_recirc', confirm: ['Default written as "4V 2V".'] },
      { id: 'aux_heat', behaviour: ['In heating or cooling operation with Auto fan, the highest mapped fan speed runs while the electric heat is on (High, else Medium, else Low).', 'Electric heat and the water valve relay are off when the fan is off.'] },
      'eh_pwm',
      'fa_damper', { id: 'dcv_damper', tuners: [['analogOutXAtMinDCVDamper', '0 V'], ['analogOutXAtMaxDCVDamper', '10 V']] }, { id: 'humidity', confirm: ['Humidity behaviour is taken from the CPU profile; the FCU documents only list the outputs.'] },
      'ui_types', 'condensate', 'door_window', 'key_card', 'priority', 'building_limits',
      'default_config'],
  },

  '4pipe': {
    name: '4-pipe FCU',
    summary: 'Separate heating and cooling coils, each with its own supply. The controller controls the fan speed and which coil valve opens.',
    typicalIO: 'Relays 3 + 1 (electric heat), thermal valves 2, analog outputs 4, universal inputs 6, sensor option PoR',
    portSets: [{ device: 'TFCU', ports: [['Electric heat', 'Aux heating'], ['Digital out 1', 'Fan low speed'], ['Digital out 2', 'Fan medium speed'], ['Digital out 3', 'Fan high speed'],
      ['Thermal valve 1', 'Cooling water valve'], ['Thermal valve 2', 'Heating water valve'], ['Analog out 1', 'Fan speed'], ['Analog out 2', 'Cooling modulating valve'],
      ['Analog out 3', 'Heating modulating valve'], ['Analog out 4', 'FA modulating damper'], ['Thermistor input 1', 'Return air temperature (mandatory)'],
      ['Universal input 2', 'Supply air temperature'], ['Universal input 3', 'Supply water temperature'], ['Universal input 4', 'CO₂ sensor / door-window sensor'],
      ['Universal input 5', 'Fresh-air damper feedback / CO₂ sensor'], ['Universal input 6', 'Condensate overflow']],
    options: [
      ['Digital outputs', 'Fan low speed – ventilation, Fan low, Fan medium, Fan high, Water valve, Fan enable, Occupied enable, DCV damper, Externally mapped'],
      ['Analog outputs', 'Water modulating valve, Fan speed, DCV modulating damper, Externally mapped'],
      ['Universal inputs', 'Current TX (0–10, 0–20, 0–50 A), Supply water temp, Supply air temp, Return air temp, CO₂, Condensate, Fresh-air damper feedback, Door/window Title 24 N/O & N/C, Door/window N/O & N/C, Key card N/O & N/C, Generic alarm N/O & N/C']] },
      { device: 'MyStat', ports: [['Relay 1', 'Fan low speed'], ['Relay 2', 'Fan high speed'], ['Relay 3', 'Water valve'], ['Relay 4', 'Aux heating'], ['Analog out', 'Modulating water valve'], ['Universal input', 'Supply water temperature']],
        options: [['Relays', 'Fan low speed, Fan high speed, Water valve, Aux heating, Fan enable, Occupied enable, Humidifier, Dehumidifier, Externally mapped, DCV damper'],
          ['Analog out', 'Modulating water valve, Fan speed, Externally mapped, DCV damper'], ['Universal input', 'Supply water temperature, Airflow temperature, Generic alarm N/O, Generic alarm N/C, Key card sensor, Door/window sensor']] }],
    features: [
      'zone_load_pi', 'pi_hold', { id: 'user_intent', tuners: [['maxHeatingUserTemp', '72 °F'], ['minHeatingUserTemp', '67 °F'], ['maxCoolingUserTemp', '77 °F'], ['minCoolingUserTemp', '72 °F']] }, 'occupancy',
      { id: 'cond_modes', behaviour: ['Modes offered follow the configuration: heating and cooling mapped → Off/Auto/Heat only/Cool only; heating only → Off/Heat only; cooling only → Off/Cool only; cooling + electric heat → all four.'] },
      { id: 'fan_off', behaviour: ['Water sampling continues while the fan is off; air sampling is not done.', 'Conditioning / fan mode vs sampling: Off/Off → no water or air sampling; Off/On → air sampling only; On/Off → water sampling only.'] },
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
      'fa_damper', { id: 'dcv_damper', tuners: [['analogOutXAtMinDCVDamper', '2 V'], ['analogOutXAtMaxDCVDamper', '10 V']] }, { id: 'humidity', confirm: ['Humidity behaviour is taken from the CPU profile; the FCU documents only list the outputs.'] },
      { id: 'ui_types', confirm: ['Changeover sensor N/O is mapped 0 = Heating, 1 = Cooling here (opposite of 2-pipe), and changeover is missing from the universal-input option list.'] },
      'condensate', 'door_window', 'key_card', 'priority',
      'default_config'],
  },

  cpu: {
    name: 'CPU (conventional package unit)',
    summary: 'Packaged unit with simple independent cooling and heating stages: up to 2 cooling + 2 heating stages with a single-stage fan, or 1 stage with a 2-speed fan; one analog output for a VFD, valve or modulating cooling/heating. Works as a residential/hotel unit or, with Fan enable mapped, as a commercial unit. Target applications: single-zone staged CAV RTU, single-zone modulating VAV RTU, split units; replacement for 4-wire thermostats (self-powered from the switched load).',
    typicalIO: '4 relays, 1 analog output, 1 universal input; onboard temperature, humidity and occupancy sensing',
    portSets: [{ device: 'MyStat', ports: [['Relay 1 (Y1)', 'Cooling stage 1'], ['Relay 2 (Y2)', 'Fan low speed'], ['Relay 3 (G)', 'Heating stage 1'], ['Relay 4 (W1)', 'Fan high speed'], ['Analog out', 'Cooling'], ['Universal input', 'Key card sensor']],
      options: [['Relays', 'Cooling stage 1, Cooling stage 2, Heating stage 1, Heating stage 2, Fan low speed, Fan high speed, Fan enable, Occupied enable, Humidifier, Dehumidifier, Externally mapped, DCV damper'],
        ['Analog out', 'Cooling, Heating, Linear fan speed, Staged fan, Externally mapped, DCV damper'],
        ['Universal input', 'Airflow temperature, Generic alarm N/O, Generic alarm N/C, Key card sensor, Door/window sensor, 75F wireless door sensor']] }],
    features: [
      'zone_load_pi', 'pi_hold', { id: 'user_intent', behaviour: ['Target min/max inside humidity appear only when a humidifier or dehumidifier is mapped.'] }, 'occupancy',
      { id: 'zone_switchover', behaviour: ['Switch from heating to cooling happens where the cooling loop output becomes > 0 as the temperature keeps rising (and vice versa); until then the previous operation mode is held.'] },
      'cond_modes', 'fan_off',
      'staged_conditioning', 'analog_conditioning',
      { id: 'fan_staging', behaviour: ['HPU/CPU: lower fan relays stay on together with higher ones (stated in the HPU profile).', 'MyStat CPU has 2 fan speeds (low, high): Low on when fan loop > relayActivationHysteresis, off at 0; High on above 50% + H/2, off at ≤ 50% − H/2.'],
        confirm: ['Example text refers to "3 stages" and "Fan stage 3 … 66%" although only low/high are offered.'] },
      { id: 'fan_analog', tuners: [['analogOutXAtMinFan', '2 V'], ['analogOutXAtMaxFan', '10 V'], ['analogOutXAtFanLow', '30%'], ['analogOutXAtFanMedium', '60%'], ['analogOutXAtFanHigh', '100%']] },
      'fan_staged_analog', 'fan_modes', 'fan_application', 'fan_enable',
      { id: 'min_fan_runtime', behaviour: ['Staged fan config: runs at the stage-1 fan speed; linear (analog) fan: last known value in occupied mode; relay fan: last known speed.'] },
      { id: 'analog_recirc', behaviour: ['Staged fan config: Analog at Recirc sets the fan speed when the loops are zero / zone in deadband, so the zone still gets recirculation.'] },
      { id: 'humidity' },
      'ui_types',
      { id: 'door_window', behaviour: ['Title 24: mechanical cooling is shut off and the minimum fan speed runs — analog fan at Analog at Min, staged fan at Analog at Recirc, relay fan at the lowest mapped speed.', 'Up to 2 door/window sensors per unit (including the 75F wireless door sensor); only one key card sensor.'],
        confirm: ['FCU profiles run the analog fan at Analog at Recirc for Title 24; CPU says Analog at Min.'] },
      'key_card',
      { id: 'default_config', confirm: ['Onboard sensing is listed as temperature/humidity/occupancy, while another section mentions onboard CO₂ for DCV.', 'Relay terminal labels differ between tables (G/W1 shown as Fan enable/Heating stage 1 in one, Heating stage 1/Fan high in the default list).'] }],
  },

  hpu: {
    name: 'HPU (heat pump unit)',
    summary: 'A compressor provides both cooling and heating; a reversing valve (changeover relay O/B) decides which. An auxiliary heat source such as an electric element is added for when compressor heating is not enough.',
    typicalIO: 'HyperStat: 6 relays, 3 analog outputs, 2 thermistor inputs, 2 analog inputs; onboard temperature, humidity, CO₂, occupancy, sound and light. MyStat: 4 relays, 1 analog output, 1 universal input',
    portSets: [
      { device: 'HyperStat', ports: [['Relay 1 (Y1)', 'Compressor stage 1'], ['Relay 2 (Y2)', 'Compressor stage 2'], ['Relay 3 (G)', 'Fan low speed'], ['Relay 4 (W1)', 'Aux heating stage 1'], ['Relay 5 (W2)', 'Fan medium speed'], ['Relay 6 (O/B)', 'Changeover, type O (energize in cooling)'],
          ['Analog out 1', 'Compressor speed'], ['Analog out 2', 'Fan speed'], ['Analog out 3', 'DCV damper'], ['Thermistor 1', 'Airflow temperature'], ['Thermistor 2', 'Door/window sensor 1'], ['Analog in 1', 'Key card sensor'], ['Analog in 2', 'Current TX (0–20 A)']],
        options: [['Relays', 'Compressor stage 1, 2, 3, Aux heating stage 1, 2, Fan low, Fan medium, Fan high, Fan enable, Occupied enable, Humidifier, Dehumidifier, Changeover (type O or B), DCV damper'],
          ['Analog outputs', 'Compressor speed, Fan speed, DCV damper'], ['Thermistor 2', 'Door/window sensor 1, External 10K room temperature sensor'],
          ['Analog inputs', 'Current TX (0–10, 0–20, 0–50 A), Key card sensor, Door/window sensor'], ['Other', 'Occupancy sensing enable']] },
      { device: 'MyStat', ports: [['Relay 1', 'Compressor stage 1'], ['Relay 2', 'Aux heating stage'], ['Relay 3', 'Fan low speed'], ['Relay 4', 'O – energize in cooling'], ['Analog out', 'Compressor speed'], ['Universal input', 'Key card sensor']],
        options: [['Relays', 'Compressor stage 1, Compressor stage 2, Aux heating stage, O – energize in cooling, B – energize in heating, Fan low speed, Fan high speed, Fan enable, Occupied enable, Humidifier, Dehumidifier, Externally mapped, DCV damper'],
          ['Analog out', 'Compressor speed, Fan speed, Externally mapped, DCV damper'], ['Universal input', 'Airflow temperature, Generic alarm N/O, Generic alarm N/C, Key card sensor, Door/window sensor']] }],
    features: [
      'zone_load_pi', 'pi_hold', { id: 'user_intent', behaviour: ['Target min/max inside humidity appear only when a humidifier or dehumidifier is mapped.'] }, 'occupancy', 'zone_switchover',
      { id: 'cond_modes', behaviour: ['Change request: with conditioning Off and fan Auto, fan stages still run from the cooling loop (fan loop); a Fan enable relay stays on when occupied and turns on when unoccupied whenever fan loop > 0.'],
        confirm: ['This change request conflicts with "Off: all outputs off".'] },
      'fan_off',
      'compressor_staged', 'compressor_modulating', 'hp_changeover',
      { id: 'fan_staging', behaviour: ['HPU/CPU: lower fan relays stay on together with higher ones (at 100% loop Low, Medium and High are all on), unlike the FCU profiles where only the highest qualifying stage is on.'] },
      { id: 'fan_analog', tuners: [['analogOutXAtMinFan', '2 V'], ['analogOutXAtMaxFan', '10 V'], ['analogOutXAtFanLow', '70%'], ['analogOutXAtFanMedium', '80%'], ['analogOutXAtFanHigh', '100%']],
        confirm: ['Acceptance criteria give 30% / 60% / 100% as the defaults.'] },
      { id: 'fan_modes', behaviour: ['Fixed Medium or High modes also switch on the lower mapped fan relays.'] }, 'fan_enable',
      'aux_heat_2stage',
      { id: 'dcv_damper', tuners: [['analogOutXAtMinDCVDamperPos', '2 V'], ['analogOutXAtMaxDCVDamperPos', '10 V'], ['CO₂ damper opening rate', '10% (0–200%)'], ['CO₂ threshold', '800 ppm (0–2000)'], ['CO₂ target', '1000 ppm (0–2000)']] },
      'dcv_relay', 'humidity',
      { id: 'ui_types', behaviour: ['Thermistor 2 can be a door/window sensor or an external 10K room temperature sensor.', 'Up to 2 door/window sensors per unit, numbered by input; only one key card sensor.'] },
      'door_window', 'key_card',
      'temp_offset', 'output_test',
      { id: 'default_config', confirm: ['Acceptance criteria list different relay defaults (Cooling stage 1/2, Heating stage 1, Fan high on relay 5) and an "Aux heating" analog output option (2–10 V) that is not in the main option list.'] }],
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
