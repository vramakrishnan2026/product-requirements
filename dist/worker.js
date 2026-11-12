// Product Spec Configurator — Cloudflare Worker (Phase 1)
// Bindings expected:
//   DB               D1 database (product-spec-db)
//   ACCESS_PASSWORD  secret: the shared password
//   SESSION_SECRET   secret (optional but recommended): random string used to sign login cookies
//   MCP_TOKEN        secret (optional): enables the ChatGPT/Claude MCP endpoint at /mcp/<MCP_TOKEN>
//
// The page HTML is injected at build time (see build.mjs) as HTML below.

const HTML = "<!DOCTYPE html>\n<html lang=\"en\">\n<head>\n<meta charset=\"utf-8\">\n<meta name=\"viewport\" content=\"width=device-width, initial-scale=1\">\n<title>Product Spec Configurator</title>\n<style>\n  :root{\n    --bg:#f5f7fa; --panel:#fff; --ink:#18212f; --muted:#5d6b7e; --line:#dde3ea;\n    --brand:#0b4ea2; --brand-ink:#fff; --brand-soft:#e8f0fb; --warn:#9a5b00; --warn-soft:#fff4e0;\n    --ok:#1d7a46; --ok-soft:#e6f5ec; --radius:10px;\n  }\n  *{box-sizing:border-box}\n  body{margin:0;font:14px/1.45 system-ui,-apple-system,\"Segoe UI\",Roboto,sans-serif;background:var(--bg);color:var(--ink)}\n  button,input,select,textarea{font:inherit;color:inherit}\n  header{display:flex;align-items:center;gap:12px;padding:10px 20px;background:var(--panel);border-bottom:1px solid var(--line);position:sticky;top:0;z-index:5}\n  header h1{font-size:16px;margin:0;font-weight:650}\n  header .sp{flex:1}\n  .btn{border:1px solid var(--line);background:var(--panel);padding:7px 12px;border-radius:8px;cursor:pointer}\n  .btn:hover{border-color:#b9c3cf}\n  .btn.primary{background:var(--brand);border-color:var(--brand);color:var(--brand-ink)}\n  .btn.primary:hover{filter:brightness(1.08)}\n  .btn.ghost{border-color:transparent;background:transparent;color:var(--muted)}\n  .btn.danger{color:#b42318}\n  .hidden{display:none!important}\n  main{max-width:1320px;margin:0 auto;padding:20px}\n  /* login */\n  .login{max-width:360px;margin:12vh auto;background:var(--panel);border:1px solid var(--line);border-radius:var(--radius);padding:28px}\n  .login h2{margin:0 0 4px;font-size:18px}\n  .login p{margin:0 0 18px;color:var(--muted)}\n  .login input{width:100%;padding:9px 11px;border:1px solid var(--line);border-radius:8px;margin-bottom:12px}\n  .err{color:#b42318;min-height:20px;font-size:13px}\n  /* list */\n  .toolbar{display:flex;gap:10px;align-items:center;margin-bottom:14px}\n  .toolbar input{flex:1;max-width:360px;padding:8px 11px;border:1px solid var(--line);border-radius:8px;background:var(--panel)}\n  table.list{width:100%;border-collapse:collapse;background:var(--panel);border:1px solid var(--line);border-radius:var(--radius);overflow:hidden}\n  table.list th,table.list td{text-align:left;padding:10px 14px;border-bottom:1px solid var(--line)}\n  table.list th{font-size:12px;text-transform:uppercase;letter-spacing:.04em;color:var(--muted);background:#fafbfc}\n  table.list tr.row{cursor:pointer}\n  table.list tr.row:hover td{background:var(--brand-soft)}\n  .empty{padding:40px;text-align:center;color:var(--muted);background:var(--panel);border:1px dashed var(--line);border-radius:var(--radius)}\n  .pill{display:inline-block;padding:2px 8px;border-radius:99px;font-size:12px;background:#eef1f5;color:var(--muted)}\n  .pill.submitted,.pill.in_review{background:var(--warn-soft);color:var(--warn)}\n  .pill.approved{background:var(--ok-soft);color:var(--ok)}\n  /* editor */\n  .editor{display:grid;grid-template-columns:200px minmax(0,1fr) 300px;gap:20px;align-items:start}\n  nav.secnav{position:sticky;top:70px;display:flex;flex-direction:column;gap:2px}\n  nav.secnav a{padding:6px 10px;border-radius:7px;color:var(--muted);text-decoration:none;font-size:13px;display:flex;justify-content:space-between;gap:6px}\n  nav.secnav a:hover{background:var(--panel);color:var(--ink)}\n  nav.secnav a .n{font-size:11px;color:#9aa6b4}\n  section.card{background:var(--panel);border:1px solid var(--line);border-radius:var(--radius);padding:18px 20px;margin-bottom:16px;scroll-margin-top:70px}\n  section.card h2{font-size:15px;margin:0 0 2px;display:flex;align-items:center;gap:8px}\n  section.card .desc{color:var(--muted);margin:0 0 14px;font-size:13px}\n  .phase{font-size:11px;font-weight:600;padding:2px 7px;border-radius:99px;background:var(--warn-soft);color:var(--warn)}\n  .grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px 18px}\n  .f{display:flex;flex-direction:column;gap:5px;min-width:0}\n  .f.wide{grid-column:1/-1}\n  .f.sub{border-left:3px solid var(--brand-soft);padding-left:12px}\n  .f label.lbl{font-weight:560;font-size:13px}\n  .f .hint{color:var(--muted);font-size:12px}\n  .f input[type=text],.f input[type=number],.f input[type=date],.f select,.f textarea{width:100%;padding:8px 10px;border:1px solid var(--line);border-radius:8px;background:#fff}\n  .f textarea{min-height:68px;resize:vertical}\n  .f input:focus,.f select:focus,.f textarea:focus{outline:2px solid var(--brand-soft);border-color:var(--brand)}\n  .chips{display:flex;flex-wrap:wrap;gap:6px}\n  .chips label{display:flex;align-items:center;gap:6px;border:1px solid var(--line);border-radius:99px;padding:5px 11px;cursor:pointer;user-select:none;font-size:13px;background:#fff}\n  .chips input{margin:0;accent-color:var(--brand)}\n  .chips label.on{background:var(--brand-soft);border-color:var(--brand);color:var(--brand)}\n  .seg{display:inline-flex;border:1px solid var(--line);border-radius:8px;overflow:hidden;width:max-content}\n  .seg button{border:0;background:#fff;padding:6px 14px;cursor:pointer;border-right:1px solid var(--line)}\n  .seg button:last-child{border-right:0}\n  .seg button.on{background:var(--brand);color:#fff}\n  .pf{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:6px 14px;align-items:center;padding:8px 0;border-top:1px solid var(--line)}\n  .pf .lbl{font-weight:560}\n  .pf details{grid-column:1/-1;font-size:12.5px;color:var(--muted)}\n  .pf details summary{cursor:pointer;width:max-content}\n  .pf details ul{margin:6px 0 4px;padding-left:18px}\n  .pf table{border-collapse:collapse;margin:4px 0 6px;font-size:12px}\n  .pf td{border:1px solid var(--line);padding:2px 8px}\n  .pf .confirm{color:var(--warn)}\n  .seg button.dflt{background:var(--brand-soft);color:var(--brand)}\n  .grp{grid-column:1/-1;font-size:12px;font-weight:650;text-transform:uppercase;letter-spacing:.05em;color:var(--brand);margin-top:12px}\n  .feat{display:grid;grid-template-columns:minmax(0,1.3fr) 150px minmax(0,1.5fr) 32px;gap:8px;margin-bottom:8px}\n  .feat input,.feat select{padding:7px 9px;border:1px solid var(--line);border-radius:8px;background:#fff;width:100%}\n  /* summary */\n  aside.summary{position:sticky;top:70px;background:var(--panel);border:1px solid var(--line);border-radius:var(--radius);padding:16px;max-height:calc(100vh - 90px);overflow:auto}\n  aside.summary h3{margin:0 0 10px;font-size:13px;text-transform:uppercase;letter-spacing:.04em;color:var(--muted)}\n  .kv{display:grid;grid-template-columns:auto 1fr;gap:4px 10px;font-size:13px;margin-bottom:14px}\n  .kv dt{color:var(--muted)} .kv dd{margin:0;font-weight:520;word-break:break-word}\n  .device{display:flex;justify-content:center;margin:6px 0 14px}\n  .topbar{display:flex;gap:10px;align-items:center;margin-bottom:16px;flex-wrap:wrap}\n  .topbar .title{font-size:18px;font-weight:650;flex:1;min-width:200px}\n  .topbar select{padding:7px 10px;border:1px solid var(--line);border-radius:8px;background:#fff}\n  .saved{color:var(--muted);font-size:12px}\n  .toast{position:fixed;bottom:20px;left:50%;transform:translateX(-50%);background:#18212f;color:#fff;padding:9px 16px;border-radius:8px;font-size:13px;opacity:0;transition:opacity .2s;pointer-events:none}\n  .toast.show{opacity:1}\n  @media (max-width:1100px){.editor{grid-template-columns:minmax(0,1fr)} nav.secnav,aside.summary{position:static;max-height:none} nav.secnav{flex-direction:row;flex-wrap:wrap}}\n  @media (max-width:640px){.grid{grid-template-columns:1fr} .feat{grid-template-columns:1fr}}\n</style>\n</head>\n<body>\n<header>\n  <h1>Product Spec Configurator</h1>\n  <span class=\"pill\">Phase 1 · POC</span>\n  <span class=\"sp\"></span>\n  <button class=\"btn ghost hidden\" id=\"btnLogout\">Sign out</button>\n</header>\n\n<main>\n  <!-- Login -->\n  <div class=\"login hidden\" id=\"viewLogin\">\n    <h2>Sign in</h2>\n    <p>Enter the shared access password.</p>\n    <form id=\"loginForm\">\n      <input type=\"password\" id=\"pw\" placeholder=\"Password\" autocomplete=\"current-password\" required>\n      <div class=\"err\" id=\"loginErr\"></div>\n      <button class=\"btn primary\" style=\"width:100%\">Continue</button>\n    </form>\n  </div>\n\n  <!-- List -->\n  <div class=\"hidden\" id=\"viewList\">\n    <div class=\"toolbar\">\n      <input id=\"search\" placeholder=\"Search requirements…\">\n      <span class=\"sp\" style=\"flex:1\"></span>\n      <button class=\"btn primary\" id=\"btnNew\">+ New requirement</button>\n    </div>\n    <div id=\"listWrap\"></div>\n  </div>\n\n  <!-- Editor -->\n  <div class=\"hidden\" id=\"viewEdit\">\n    <div class=\"topbar\">\n      <button class=\"btn\" id=\"btnBack\">← All requirements</button>\n      <div class=\"title\" id=\"edTitle\">New requirement</div>\n      <span class=\"saved\" id=\"savedAt\"></span>\n      <select id=\"status\" title=\"Status\">\n        <option value=\"draft\">Draft</option>\n        <option value=\"submitted\">Submitted</option>\n        <option value=\"in_review\">In review</option>\n        <option value=\"approved\">Approved</option>\n        <option value=\"archived\">Archived</option>\n      </select>\n      <button class=\"btn\" id=\"btnCopyOneNote\" title=\"Copies the full document with formatting; paste into a OneNote page\">Copy for OneNote</button>\n      <button class=\"btn ghost\" id=\"btnExportMd\" title=\"Markdown file: for AI chats or email\">.md</button>\n      <button class=\"btn ghost\" id=\"btnExportJson\">JSON</button>\n      <button class=\"btn primary\" id=\"btnSave\">Save</button>\n    </div>\n    <div class=\"editor\">\n      <nav class=\"secnav\" id=\"secnav\"></nav>\n      <div id=\"form\"></div>\n      <aside class=\"summary\" id=\"summary\"></aside>\n    </div>\n  </div>\n</main>\n<div class=\"toast\" id=\"toast\"></div>\n\n<script>\n/* =====================================================================\n   FORM DEFINITION\n   Every question lives here. To add a question, add a field object;\n   no database change is needed (answers are stored as JSON and\n   flattened automatically for matching).\n\n   field: { key, label, type, options, hint, wide, showIf, unit }\n   types: text | textarea | number | date | select | multi | yesno | ynt | features\n   showIf: { k:'other.key', eq:'x' } | { k, in:[..] } | { k, has:'x' } | { k, gt:0 }\n           or an array of those (all must hold)\n   options:'@families' pulls the product-family list from the database.\n   ===================================================================== */\n/* Profile library: reusable control features shared by profiles, and the\n   profiles that use them. Inlined into the page and the Worker by build.mjs.\n\n   FEATURES[id] = { name, group, behaviour: [lines], tuners: [[name, default]], confirm: [lines] }\n     - behaviour: the standard behaviour, written so other profiles/products can reuse it\n     - confirm:   items copied as written from the source that still need a decision\n   PROFILES[id] = { name, summary, typicalIO, ports, options, features: [id | {id, behaviour?, tuners?, confirm?}] }\n     - a feature entry can add profile-specific lines / tuner defaults (merged over the shared feature)\n   The profile id must match an option value of fw.profiles in form.js. */\n\nconst FEATURE_GROUPS = ['Control & setpoints', 'Modes', 'Water side', 'Fan', 'Electric heat', 'Ventilation', 'Inputs & protection', 'Configuration'];\n\nconst FEATURES = {\n  /* ---- Control & setpoints ---- */\n  zone_load_pi: { name: 'Zone load and PI loops', group: 'Control & setpoints',\n    behaviour: [\n      'Deadbands are used only by the scheduler to set the cooling and heating desired temperatures; zone load calculations do not use them.',\n      'Cooling load = current temp − cooling desired temp when current > cooling desired, otherwise 0.',\n      'Heating load = heating desired temp − current temp when current < heating desired, otherwise 0.',\n      'Cooling loop output = PI(current temp, cooling desired temp) when current > cooling desired, otherwise 0 (0–100%).',\n      'Heating loop output = PI(current temp, heating desired temp) when current < heating desired, otherwise 0 (0–100%).',\n      'Loop outputs are mapped to the configured staged digital outputs or modulating analog signals.'],\n    tuners: [['coolingDeadband', '2 °F'], ['heatingDeadband', '2 °F'], ['temperatureProportionalRange', '2 °F'], ['temperatureIntegralTime', '30 min'], ['proportionalKFactor', '0.5'], ['integralKFactor', '0.5']] },\n\n  pi_hold: { name: 'Keep PI loops when outputs are forced off', group: 'Control & setpoints',\n    behaviour: ['When outputs must be switched off (condensate, door/window, etc.) only the ports are switched off; PI loops are never reset, so control resumes from the previous loop value once the condition clears.'] },\n\n  user_intent: { name: 'User intent and setpoint limits', group: 'Control & setpoints',\n    behaviour: [\n      'User intent: current temperature, zone cooling and heating target temperatures (affected by the schedule), schedule and vacation as in other zones.'],\n    tuners: [['maxHeatingUserTemp', '72 °F'], ['minHeatingUserTemp', '67 °F'], ['maxCoolingUserTemp', '77 °F'], ['minCoolingUserTemp', '72 °F']] },\n\n  occupancy: { name: 'Auto-away and auto forced-occupied', group: 'Control & setpoints',\n    behaviour: [\n      'Auto-away and auto forced-occupied can each be disabled in configuration; all algorithm operations follow the setting.',\n      'Forced occupied lasts forcedOccupiedTime; auto-away applies the setback after autoAwayTime.'],\n    tuners: [['forcedOccupiedTime', '120 min'], ['autoAwayTime', '30 min'], ['autoAwayZoneSetbackTemp', '2 °F']] },\n\n  zone_switchover: { name: 'Auto changeover with built-in hysteresis', group: 'Control & setpoints',\n    behaviour: [\n      'In Auto, once in heating the unit stays in heating operation mode as temperature rises through the deadband, and only switches to cooling when the current temperature exceeds the cooling desired temperature (and vice versa).',\n      'No changeover happens inside the deadband, which prevents relay chattering.'] },\n\n  /* ---- Modes ---- */\n  cond_modes: { name: 'Conditioning modes', group: 'Modes',\n    behaviour: [\n      'User can choose Off / Auto / Heat only / Cool only, limited to what the configuration supports.',\n      'Off: normal operation stops; all digital outputs and thermal valves (heating, cooling, fan) are off and analog outputs go to their minimum.',\n      'RE 2020 modes: Comfort (user-defined temperature from zone or device), Economy (setback temperatures), Freeze protection (emergency conditioning), Off.'] },\n\n  fan_off: { name: 'Fan mode Off', group: 'Modes',\n    behaviour: [\n      'Fan Off from the CCU or portals/apps stops normal operation: digital outputs and thermal valves off, analog outputs at minimum.',\n      'Water sampling continues while the fan is off; air sampling is not done.',\n      'Conditioning / fan mode vs sampling: Off/Off → no water or air sampling; Off/On → air sampling only; On/Off → water sampling only.'] },\n\n  /* ---- Water side ---- */\n  water_mode_detect: { name: 'Heating/cooling detection from supply water', group: 'Water side',\n    behaviour: [\n      'Supply water temperature above the Fancoil Heating Threshold → heating operation; below the Fancoil Cooling Threshold → cooling operation.',\n      'Alternatively a changeover sensor (N/O or N/C) decides the operation. If both are mapped the changeover sensor has priority and the user is told so in a pop-up; a second changeover sensor cannot be mapped.'],\n    tuners: [['Fancoil Heating Threshold', '85 °F'], ['Fancoil Cooling Threshold', '65 °F']],\n    confirm: ['Supply water temperature is listed as \"mandatorily enabled\", while the changeover sensor is described as an alternative.'] },\n\n  valve_onoff: { name: 'Water valve on/off (relay)', group: 'Water side',\n    behaviour: [\n      'With the fan not off: the valve relay turns on when the loop output > relayActivationHysteresis and off when the loop output = 0.',\n      'With the fan off: the valve relay is deactivated.'] },\n\n  valve_modulating: { name: 'Modulating water valve (analog)', group: 'Water side',\n    behaviour: [\n      'The valve signal modulates between analogOutXAtMin… and analogOutXAtMax… as the loop output goes 0–100%.',\n      'Reverse acting is allowed: max may be lower than min (e.g. 10 V = closed, 2 V = fully open).',\n      'Min and max are configurable 0–10 V in 1 V steps.'] },\n\n  thermal_valve_pwm: { name: 'Thermal valve PWM', group: 'Water side',\n    behaviour: [\n      'Thermal actuators use PWM only (no plain on/off).',\n      'thermalValveOpeningTime (time to open 0→100%) is applied at the start of a load request.',\n      'With a 20 s time base: 100% load → valve on every cycle; 50% load → 10 s on, 10 s off.',\n      'During water sampling the valve opens for the opening time and is then held open for the sampling on-time; if zone load appears during sampling, it switches to PWM starting with the on-time.'],\n    tuners: [['thermalValvePWMtimeBase', '20 s'], ['thermalValveOpeningTime', '3 min']],\n    confirm: ['A second section names the tuners thermalValveOnTime and thermalValveWaitTime instead.'] },\n\n  water_sampling: { name: 'Water sampling', group: 'Water side',\n    behaviour: [\n      'Mode known (water above heating threshold or below cooling threshold) and loop > 0: if the valve has not been on for waterValveSamplingWaitTime, open it for waterValveSamplingOnTime so the reading is not of stagnant water.',\n      'Mode not known (water between the thresholds): if the valve has not been on for waterValveSamplingDuringLoopDeadbandWaitTime, open it for waterValveSamplingDuringLoopDeadbandOnTime so enough water flows to decide the mode.',\n      'No sampling while the zone is in deadband (loop = 0); the valve is off.',\n      'Either water sampling or a changeover sensor determines the operation.'],\n    tuners: [['waterValveSamplingWaitTime', '58 min'], ['waterValveSamplingOnTime', '2 min'], ['waterValveSamplingDuringLoopDeadbandWaitTime', '5 min'], ['waterValveSamplingDuringLoopDeadbandOnTime', '2 min']],\n    confirm: ['Condition written as \"loop output > 0 and loop is less than relayActivationHysteresis\" in one place and \"within relayActivationHysteresis\" in another.',\n      'Sync notes say this is not testable and was not included in the firmware; suggestion was to set error to 5 and verify.'] },\n\n  air_sampling: { name: 'Air sampling (return air sensor)', group: 'Water side',\n    behaviour: [\n      'Available only when a return air temperature sensor is mapped; enabled by a toggle (in firmware, always done when on).',\n      'When the supply water is between the heating and cooling thresholds (deadband) and the fan has not run for AirSamplingWaitTime, run it for AirSamplingOnTime: lowest mapped relay speed, or Analog at Recirc for an analog fan. With fan Auto, the lowest speed is used.',\n      'When mapped, the return air sensor replaces the current temperature sensor for zone load and is shown on the device screen.'],\n    tuners: [['AirSamplingWaitTime', '30 min'], ['AirSamplingOnTime', '1 min']] },\n\n  /* ---- Fan ---- */\n  fan_staging: { name: 'Staged fan (relays)', group: 'Fan',\n    behaviour: [\n      'Stages: low-ventilation, low, medium, high; only one fan digital output is on at a time.',\n      'Fan loop output = cooling (or heating) loop output × analogFanSpeedMultiplier, capped at 100%.',\n      '3 stages: Low on when fan loop > relayActivationHysteresis, off at 0; Medium on above 33% + H/2, off at ≤ 33% − H/2; High on above 66% + H/2, off at ≤ 66% − H/2.',\n      'Flexible stages: the highest stage mapped sets the number of stages (e.g. only High mapped → it turns on above 66% + H).',\n      'Low-ventilation: on when fan loop = 0 during the occupied schedule and when fan loop > 0 when unoccupied; with Medium/High mapped it runs up to 33% + H/2.',\n      'Stage transitions depend on the active stage, not on the loop direction: step up above threshold + H/2, step down below threshold − H/2, otherwise hold (e.g. 3 stages, 20% H: Medium→High above 76, High→Medium below 56, Low→Medium above 43, Medium→Low below 23). Applies to all devices; existing stage up/down timers stay on top.'],\n    tuners: [['relayActivationHysteresis', '10%'], ['analogFanSpeedMultiplier', '1']],\n    confirm: ['Low stage turn-on is written as \"> relayActivationHysteresis\", while the electric-heat examples and the \"same behaviour at loop start\" requirement use H/2.'] },\n\n  fan_analog: { name: 'Analog fan speed (EC fan)', group: 'Fan',\n    behaviour: [\n      'Fan signal modulates between analogOutXAtMinFan and analogOutXAtMaxFan as the fan loop goes 0–100%.',\n      'For manual Low/Medium/High selections the output is set to a % of (max − min): analogOutXAtFanLow / Medium / High.',\n      'With the fan on an analog output, all fan mode options are offered.'] },\n\n  fan_modes: { name: 'Fan modes (user intent)', group: 'Fan',\n    behaviour: [\n      'Auto: fan runs whenever heating or cooling occurs, following the fan stages / fan loop.',\n      'For each mapped speed (Low, Medium, High): Current occupied period (on until the end of the current occupied time, then back to Auto), Occupied period (on during scheduled occupied time every day, back to Auto at the end), All times (always on).',\n      'Options offered depend on the speeds mapped; a higher speed can be mapped without lower ones. Analog fan uses analogOutXAtFanLow/Medium/High for the fixed speeds.'] },\n\n  fan_enable: { name: 'Fan enable and occupied enable outputs', group: 'Fan',\n    behaviour: [\n      'Fan enable: output on whenever the zone is occupied, and also when conditioning during the unoccupied schedule.',\n      'Occupied enable: output on during the occupied schedule only, not when conditioning while unoccupied.'] },\n\n  min_fan_runtime: { name: 'Minimum fan run time after conditioning', group: 'Fan',\n    behaviour: [\n      'When a water valve or the electric heat turns off (in occupied, or on the transition to unoccupied), the fan keeps running at the last speed for minFanRuntimePostConditioning; an analog fan runs at Analog at Recirc.',\n      'Also applies when the user turns the electric heater off.'],\n    tuners: [['minFanRuntimePostConditioning', '5 min']] },\n\n  analog_recirc: { name: 'Analog at Recirc', group: 'Fan',\n    behaviour: [\n      'When the cooling and heating loops are zero and the fan is on an analog output, the fan runs at Analog at Recirc (sent to the device in volts).',\n      'Moving from recirculation to load, the PI-driven signal starts from Analog at Min (e.g. 4 V in deadband, then scales up from 2 V).'],\n    tuners: [['Analog at Recirc', '4 V']] },\n\n  /* ---- Electric heat ---- */\n  aux_heat: { name: 'Electric heat as auxiliary heat', group: 'Electric heat',\n    behaviour: [\n      'Used when hot water is available.',\n      'On when current temp < heating desired temp − auxHeatingActivate.',\n      'Electric heat never runs without the fan.'],\n    tuners: [['auxHeatingActivate', '3 °F (absolute; same number for °F and °C)']],\n    confirm: ['Off point written two ways: OFF = CT > (HDT − auxHeatingActivate − 1) gives 66 °F at 70 °F setpoint, but the worked example and the later formula (HDT − (auxHeatingActivate − 1)) give 68 °F.'] },\n\n  eh_pwm: { name: 'Electric heat PWM (primary heat)', group: 'Electric heat',\n    behaviour: [\n      'Used as the primary heat source when hot water is not available (supply water in deadband or cooling).',\n      'Relay cycles on a 2 min time base (AuxHeatingCycleTime) in proportion to the heating loop, starting at loop = H/2 (e.g. 25% → 30 s on / 90 s off; 39% → 46.8 s; 72% → 86.4 s; 100% → continuously on).',\n      'Fan Auto: highest mapped fan speed runs with the heater.',\n      'Fixed fan speeds set the duty cycle: Low = AuxHeatingDutyCycleLow, Medium = …Medium, High = …High of the cycle time.'],\n    tuners: [['AuxHeatingCycleTime', '2 min'], ['AuxHeatingDutyCycleLow', '25%'], ['AuxHeatingDutyCycleMedium', '50%'], ['AuxHeatingDutyCycleHigh', '100%']] },\n\n  /* ---- Ventilation ---- */\n  fa_damper: { name: 'Fresh-air damper (relay)', group: 'Ventilation',\n    behaviour: [\n      'Sets the minimum outside-air damper position. When zone CO₂ > CO₂ threshold and the zone is occupied or forced occupied: FAD loop = (zone CO₂ − threshold) / damper opening rate.',\n      'FAD loop = 0 when CO₂ < threshold, unoccupied or pre-conditioning. The relay turns on when the FAD loop > relayActivationHysteresis.'] },\n\n  dcv_damper: { name: 'DCV modulating damper (analog)', group: 'Ventilation',\n    behaviour: [\n      'Signal modulates between analogOutXAtMinDCVDamper and …Max as zone CO₂ rises above the threshold: DCV loop = (zone CO₂ − threshold) / damper opening rate; 0 when below threshold, unoccupied or pre-conditioning.',\n      'Display labels: CO₂ target → \"Alert Ovr\", CO₂ damper opening rate → \"Damp Full opn\", CO₂ threshold → \"Damp Start opn\".'] },\n\n  humidity: { name: 'Humidifier / dehumidifier outputs', group: 'Ventilation',\n    behaviour: ['Humidifier and dehumidifier follow the standard humidity logic.'],\n    tuners: [['humidityHysteresis', '5%']],\n    confirm: ['Listed only in some output option lists; behaviour is not described in the profile.'] },\n\n  /* ---- Inputs & protection ---- */\n  ui_types: { name: 'Universal input types', group: 'Inputs & protection',\n    behaviour: [\n      'Current TX 0–10 / 0–20 / 0–50 A (0–10 V) — monitoring.',\n      'Supply air, return air, supply water temperature — thermistor, −58 to 302 °F (NTC type 2). Return air is used for air sampling.',\n      'CO₂ — 0–2000 ppm on 0–10 V — DCV.',\n      'Fresh-air damper feedback — 0–100% on 0–10 V — monitoring.',\n      'Dry contacts (N/O and N/C, threshold 10 kΩ): condensate overflow, door/window (Title 24 and normal), key card, generic alarm (monitoring), changeover.'] },\n\n  condensate: { name: 'Condensate overflow protection', group: 'Inputs & protection',\n    behaviour: ['When condensate overflow is detected, cooling, heating and fan outputs on relays/thermal valves are off and analog outputs are at minimum.'] },\n\n  door_window: { name: 'Door/window sensor', group: 'Inputs & protection',\n    behaviour: [\n      'Title 24 type: lowest mapped fan speed keeps running (analog fan at Analog at Recirc).',\n      'Normal type: all relays off, analog outputs at minimum.',\n      'A Title 24 and a normal door/window sensor of the same contact type cannot both be mapped.'] },\n\n  key_card: { name: 'Key card sensor', group: 'Inputs & protection',\n    behaviour: [\n      'Card in slot (occupant present): if unoccupied, the zone goes to forced occupied and the desired temperature changes.',\n      'Card out of slot: if occupied, the zone goes to key-card auto-away using the auto-away setback.',\n      'Key card has priority over the occupancy sensor.'] },\n\n  priority: { name: 'Safety and input priority', group: 'Inputs & protection',\n    behaviour: [\n      'Overall priority: Emergency shutoff > Freezestat > Door/window (Title 24) > Door/window > Condensate overflow > User intents.',\n      'Universal-input functions: Conditioning mode Off > Condensate overflow > Door/window (Title 24) > Door/window > Key card.'] },\n\n  building_limits: { name: 'Sensor validity against building limits', group: 'Inputs & protection',\n    behaviour: ['Building limits decide whether temperatures reported by the sensors are valid.'],\n    confirm: ['Source text (16 Oct addition) is incomplete.'] },\n\n  /* ---- Configuration ---- */\n  default_config: { name: 'Default configuration on pairing', group: 'Configuration',\n    behaviour: [\n      'On first pairing the CCU loads the default configuration from the .ini file and shows it on the configuration page.',\n      'Changes made on the CCU are saved and sent to the device.'] },\n};\n\nconst PROFILES = {\n  '2pipe': {\n    name: '2-pipe FCU',\n    summary: 'One coil supplied with either chilled or hot water by the central plant. The controller decides heating or cooling operation from the supply water temperature (or a changeover sensor) and controls the fan speed and the water valve.',\n    typicalIO: 'Relays 3 + 1 (electric heat), thermal valves 2, analog outputs 4, universal inputs 6, sensor option PoR',\n    ports: [['Electric heat', 'Aux heating'], ['Digital out 1', 'Fan low speed'], ['Digital out 2', 'Fan medium speed'], ['Digital out 3', 'Fan high speed'],\n      ['Thermal valve 1', 'Water valve'], ['Thermal valve 2', 'Water valve'], ['Analog out 1', 'Fan speed'], ['Analog out 2', 'Water modulating valve'],\n      ['Analog out 3', 'Externally mapped – not used'], ['Analog out 4', 'FA modulating damper'], ['Thermistor input 1', 'Return air temperature (mandatory)'],\n      ['Universal input 2', 'Supply air temperature'], ['Universal input 3', 'Supply water temperature (mandatory)'], ['Universal input 4', 'CO₂ sensor / door-window sensor'],\n      ['Universal input 5', 'Fresh-air damper feedback / CO₂ sensor'], ['Universal input 6', 'Condensate overflow N/C']],\n    options: [\n      ['Digital outputs', 'Fan low speed – ventilation, Fan low, Fan medium, Fan high, Water valve, Fan enable, Occupied enable, FA damper, Humidifier, Dehumidifier, Externally mapped'],\n      ['Analog outputs', 'Water modulating valve, Fan speed, FA / DCV modulating damper, Externally mapped'],\n      ['Universal inputs', 'Current TX (0–10, 0–20, 0–50 A), Supply water temp, Supply air temp, Return air temp, CO₂, Condensate overflow N/O & N/C, Fresh-air damper feedback, Door/window Title 24 N/O & N/C, Door/window N/O & N/C, Key card N/O & N/C, Generic alarm N/O & N/C, Changeover N/O & N/C']],\n    features: [\n      'zone_load_pi', 'pi_hold', 'user_intent', 'occupancy', 'zone_switchover',\n      'cond_modes', 'fan_off',\n      'water_mode_detect', 'valve_onoff', { id: 'valve_modulating', tuners: [['analogOutXAtMinWaterValve', '0 V'], ['analogOutXAtMaxWaterValve', '10 V']] },\n      'thermal_valve_pwm', 'water_sampling', 'air_sampling',\n      'fan_staging', { id: 'fan_analog', tuners: [['analogOutXAtMinFan', '0 V'], ['analogOutXAtMaxFan', '10 V'], ['analogOutXAtFanLow', '70%'], ['analogOutXAtFanMedium', '80%'], ['analogOutXAtFanHigh', '100%']] },\n      'fan_modes', 'fan_enable', { id: 'min_fan_runtime', confirm: ['Text also says 2 minutes in places.'] },\n      { id: 'analog_recirc', confirm: ['Default written as \"4V 2V\".'] },\n      { id: 'aux_heat', behaviour: ['In heating or cooling operation with Auto fan, the highest mapped fan speed runs while the electric heat is on (High, else Medium, else Low).', 'Electric heat and the water valve relay are off when the fan is off.'] },\n      'eh_pwm',\n      'fa_damper', { id: 'dcv_damper', tuners: [['analogOutXAtMinDCVDamper', '0 V'], ['analogOutXAtMaxDCVDamper', '10 V']] }, 'humidity',\n      'ui_types', 'condensate', 'door_window', 'key_card', 'priority', 'building_limits',\n      'default_config'],\n  },\n\n  '4pipe': {\n    name: '4-pipe FCU',\n    summary: 'Separate heating and cooling coils, each with its own supply. The controller controls the fan speed and which coil valve opens.',\n    typicalIO: 'Relays 3 + 1 (electric heat), thermal valves 2, analog outputs 4, universal inputs 6, sensor option PoR',\n    ports: [['Electric heat', 'Aux heating'], ['Digital out 1', 'Fan low speed'], ['Digital out 2', 'Fan medium speed'], ['Digital out 3', 'Fan high speed'],\n      ['Thermal valve 1', 'Cooling water valve'], ['Thermal valve 2', 'Heating water valve'], ['Analog out 1', 'Fan speed'], ['Analog out 2', 'Cooling modulating valve'],\n      ['Analog out 3', 'Heating modulating valve'], ['Analog out 4', 'FA modulating damper'], ['Thermistor input 1', 'Return air temperature (mandatory)'],\n      ['Universal input 2', 'Supply air temperature'], ['Universal input 3', 'Supply water temperature'], ['Universal input 4', 'CO₂ sensor / door-window sensor'],\n      ['Universal input 5', 'Fresh-air damper feedback / CO₂ sensor'], ['Universal input 6', 'Condensate overflow']],\n    options: [\n      ['Digital outputs', 'Fan low speed – ventilation, Fan low, Fan medium, Fan high, Water valve, Fan enable, Occupied enable, DCV damper, Externally mapped'],\n      ['Analog outputs', 'Water modulating valve, Fan speed, DCV modulating damper, Externally mapped'],\n      ['Universal inputs', 'Current TX (0–10, 0–20, 0–50 A), Supply water temp, Supply air temp, Return air temp, CO₂, Condensate, Fresh-air damper feedback, Door/window Title 24 N/O & N/C, Door/window N/O & N/C, Key card N/O & N/C, Generic alarm N/O & N/C']],\n    features: [\n      'zone_load_pi', 'pi_hold', 'user_intent', 'occupancy',\n      { id: 'cond_modes', behaviour: ['Modes offered follow the configuration: heating and cooling mapped → Off/Auto/Heat only/Cool only; heating only → Off/Heat only; cooling only → Off/Cool only; cooling + electric heat → all four.'] },\n      'fan_off',\n      { id: 'valve_onoff', name: 'Cooling and heating valves on/off (relay)', behaviour: ['Cooling valve follows the cooling loop output; heating valve follows the heating loop output.', 'Both valves off (analog valves at minimum) when the fan is off.'] },\n      { id: 'valve_modulating', name: 'Modulating cooling and heating valves (analog)', behaviour: ['Cooling valve signal follows the cooling loop; heating valve signal follows the heating loop.'],\n        tuners: [['analogOutXAtMinCoolingValve', '2 V'], ['analogOutXAtMaxCoolingValve', '10 V'], ['analogOutXAtMinHeatingValve', '2 V'], ['analogOutXAtMaxHeatingValve', '10 V']] },\n      'thermal_valve_pwm', 'air_sampling',\n      'fan_staging', { id: 'fan_analog', tuners: [['analogOutXAtMinFan', '2 V'], ['analogOutXAtMaxFan', '10 V'], ['analogOutXAtFanLow', '30%'], ['analogOutXAtFanMedium', '60%'], ['analogOutXAtFanHigh', '100%']] },\n      'fan_modes', 'fan_enable', 'min_fan_runtime',\n      { id: 'analog_recirc', confirm: ['A \"Recirculation\" note says analogOutXAtMin (fan) and Analog at Recirc are both fixed at 2 V, while other sections give 4 V as the default.'] },\n      { id: 'aux_heat', behaviour: [\n          'Both coils configured → electric heat is aux reheat. Heating-only → electric heat is secondary (aux) heat, as on the 2-pipe heating side. Cooling-only → electric heat is the primary heat source (see Electric heat PWM).',\n          'Auto fan: Fan medium runs whenever the electric heat is on; if medium is not mapped, the lowest mapped speed or Fan enable. Fixed fan speed: relays follow the user speed and the heat follows its own activation rule.',\n          'Electric heat and valves are off when the fan is off.'],\n        confirm: ['Worked example says it deactivates \"2 °F less than heating desired temp\" with the same numbers as 2-pipe.'] },\n      { id: 'eh_pwm', behaviour: ['Applies when the 4-pipe unit is configured with the cooling coil only.'] },\n      'fa_damper', { id: 'dcv_damper', tuners: [['analogOutXAtMinDCVDamper', '2 V'], ['analogOutXAtMaxDCVDamper', '10 V']] }, 'humidity',\n      { id: 'ui_types', confirm: ['Changeover sensor N/O is mapped 0 = Heating, 1 = Cooling here (opposite of 2-pipe), and changeover is missing from the universal-input option list.'] },\n      'condensate', 'door_window', 'key_card', 'priority',\n      'default_config'],\n  },\n};\n\n/* Resolve a profile's feature entry: shared feature + profile-specific additions. */\nfunction profileFeature(entry) {\n  const e = typeof entry === 'string' ? { id: entry } : entry;\n  const base = FEATURES[e.id];\n  return {\n    id: e.id, name: e.name || base.name, group: base.group,\n    behaviour: [...(base.behaviour || []), ...(e.behaviour || [])],\n    tuners: e.tuners ? [...(base.tuners || []), ...e.tuners] : (base.tuners || []),\n    confirm: [...(base.confirm || []), ...(e.confirm || [])],\n  };\n}\n\n/* Shared form definition: inlined into both the page and the Worker by build.mjs.\n   Edit questions here only. */\nconst O = (...pairs) => pairs.map(p => Array.isArray(p) ? {v:p[0], l:p[1]} : {v:p, l:p});\n\nconst SECTIONS = [\n  { id:'overview', title:'Overview', desc:'What is being asked for, and why.', fields:[\n    { key:'overview.title', label:'Requirement / product name', type:'text', wide:true, hint:'Working name is fine.' },\n    { key:'overview.requested_by', label:'Requested by', type:'text' },\n    { key:'overview.date_needed', label:'Needed by', type:'date' },\n    { key:'overview.product_type', label:'Product type', type:'select', options:O(['thermostat','Thermostat'],['sensor','Sensor'],['controller','Controller'],['io_module','I/O expansion module'],['gateway','Gateway'],['other','Other']) },\n    { key:'overview.product_type_other', label:'Describe product type', type:'text', showIf:{k:'overview.product_type', eq:'other'} },\n    { key:'overview.kind', label:'Type of request', type:'select', options:O(['new','New product'],['variant','Variant of an existing product'],['firmware_only','New firmware / profile on existing hardware'],['tbd','Not sure yet']) },\n    { key:'overview.base_family', label:'Existing product it builds on', type:'select', options:'@families', showIf:{k:'overview.kind', in:['variant','firmware_only']} },\n    { key:'overview.problem', label:'Customer problem / use case', type:'textarea', wide:true, hint:'Who needs it, what job it does, what exists today.' },\n    { key:'overview.regions', label:'Target regions', type:'multi', wide:true, options:O(['na','North America'],['eu','Europe'],['uk','UK'],['in','India'],['mea','Middle East & Africa'],['apac','Asia Pacific'],['latam','Latin America']) },\n    { key:'overview.volume', label:'Expected annual volume', type:'number', unit:'units' },\n    { key:'overview.target_cost', label:'Target BOM cost', type:'number', unit:'USD' },\n  ]},\n\n  { id:'io', title:'Hardware I/O', desc:'Counts per device. Leave 0 if not needed.', fields:[\n    { key:'io.relays', label:'Relay outputs', type:'number', unit:'qty' },\n    { key:'io.relay_rating', label:'Relay rating', type:'text', hint:'e.g. 2 A @ 24 VAC', showIf:{k:'io.relays', gt:0} },\n    { key:'io.analog_outputs', label:'Analog outputs', type:'number', unit:'qty' },\n    { key:'io.ao_types', label:'Analog output signal types', type:'multi', options:O(['0-10v','0–10 V'],['2-10v','2–10 V'],['4-20ma','4–20 mA'],['pwm','PWM']), showIf:{k:'io.analog_outputs', gt:0} },\n    { key:'io.analog_inputs', label:'Analog inputs', type:'number', unit:'qty' },\n    { key:'io.ai_types', label:'Analog input signal types', type:'multi', options:O(['0-10v','0–10 V'],['4-20ma','4–20 mA'],['thermistor','Thermistor'],['rtd','RTD']), showIf:{k:'io.analog_inputs', gt:0} },\n    { key:'io.universal_inputs', label:'Universal inputs', type:'number', unit:'qty' },\n    { key:'io.ui_types', label:'Universal input combinations supported', type:'multi', options:O(['thermistor_10k','10K thermistor'],['0-10v','0–10 V'],['4-20ma','4–20 mA'],['dry_contact','Dry contact'],['pulse','Pulse / counter'],['resistance','Resistance']), showIf:{k:'io.universal_inputs', gt:0} },\n    { key:'io.digital_inputs', label:'Digital / binary inputs', type:'number', unit:'qty' },\n    { key:'io.power', label:'Power supply', type:'multi', options:O(['24vac','24 VAC'],['24vdc','24 VDC'],['line','Line voltage'],['poe','PoE'],['battery','Battery']) },\n    { key:'io.other', label:'Other I/O or notes', type:'textarea', wide:true },\n  ]},\n\n  { id:'sensing', title:'On-board sensing', desc:'Sensors built into the device.', fields:[\n    { key:'sensing.onboard', label:'On-board sensors', type:'multi', wide:true, options:O(['temp','Temperature'],['humidity','Humidity'],['co2','CO₂'],['voc','VOC'],['pm','PM2.5'],['pir','PIR / occupancy'],['light','Ambient light'],['sound','Sound'],['pressure','Pressure']) },\n    { key:'sensing.external', label:'External / remote sensors to support', type:'textarea', wide:true },\n  ]},\n\n  { id:'comms', title:'Communication & protocols', desc:'Pick interfaces first; protocol questions open under each one.', fields:[\n    { key:'comms.interfaces', label:'Communication interfaces', type:'multi', wide:true, options:O(['rs485','RS-485'],['ethernet','Ethernet'],['rf','RF'],['ble','Bluetooth LE'],['nfc','NFC'],['wifi','Wi-Fi'],['usb','USB'],['other','Other']) },\n\n    { key:'comms.rs485.ports', label:'RS-485 · number of ports', type:'number', sub:true, showIf:{k:'comms.interfaces', has:'rs485'} },\n    { key:'comms.rs485.protocols', label:'RS-485 · protocols', type:'multi', sub:true, options:O(['modbus_rtu','Modbus RTU'],['bacnet_mstp','BACnet MS/TP'],['other','Other']), showIf:{k:'comms.interfaces', has:'rs485'} },\n    { key:'comms.rs485.modbus_role', label:'Modbus RTU · role', type:'select', sub:true, options:O(['client','Client (master)'],['server','Server (slave)'],['both','Both']), showIf:[{k:'comms.interfaces', has:'rs485'},{k:'comms.rs485.protocols', has:'modbus_rtu'}] },\n    { key:'comms.rs485.other', label:'RS-485 · other protocol', type:'text', sub:true, showIf:[{k:'comms.interfaces', has:'rs485'},{k:'comms.rs485.protocols', has:'other'}] },\n\n    { key:'comms.ethernet.protocols', label:'Ethernet · protocols', type:'multi', sub:true, options:O(['modbus_tcp','Modbus TCP/IP'],['bacnet_ip','BACnet/IP'],['bacnet_sc','BACnet/SC (secure)'],['other','Other']), showIf:{k:'comms.interfaces', has:'ethernet'} },\n    { key:'comms.ethernet.ports', label:'Ethernet · number of ports', type:'number', sub:true, showIf:{k:'comms.interfaces', has:'ethernet'} },\n    { key:'comms.ethernet.other', label:'Ethernet · other protocol', type:'text', sub:true, showIf:[{k:'comms.interfaces', has:'ethernet'},{k:'comms.ethernet.protocols', has:'other'}] },\n\n    { key:'comms.rf.links', label:'RF · connects to', type:'multi', sub:true, options:O(['ccu','CCU'],['peer','Other field devices'],['sensors','Wireless sensors'],['tbd','TBD']), showIf:{k:'comms.interfaces', has:'rf'} },\n    { key:'comms.rf.notes', label:'RF · band / stack notes', type:'text', sub:true, showIf:{k:'comms.interfaces', has:'rf'} },\n\n    { key:'comms.ble.uses', label:'BLE · used for', type:'multi', sub:true, options:O(['commissioning','Commissioning / setup app'],['config','Configuration'],['ota','Firmware update (OTA)'],['sensor','Sensor link'],['external','Interface to external systems']), showIf:{k:'comms.interfaces', has:'ble'} },\n    { key:'comms.ble.encryption', label:'BLE · encrypted link to the outside world?', type:'ynt', sub:true, showIf:{k:'comms.interfaces', has:'ble'} },\n\n    { key:'comms.nfc.uses', label:'NFC · used for', type:'multi', sub:true, options:O(['commissioning','Commissioning / setup'],['config','Configuration'],['identify','Tap to identify']), showIf:{k:'comms.interfaces', has:'nfc'} },\n\n    { key:'comms.wifi.protocols', label:'Wi-Fi · protocols', type:'multi', sub:true, options:O(['modbus_tcp','Modbus TCP/IP'],['bacnet_ip','BACnet/IP'],['bacnet_sc','BACnet/SC (secure)'],['mqtt','MQTT'],['other','Other']), showIf:{k:'comms.interfaces', has:'wifi'} },\n\n    { key:'comms.usb.uses', label:'USB · used for', type:'multi', sub:true, options:O(['service','Service / debug'],['ota','Firmware update'],['power','Power']), showIf:{k:'comms.interfaces', has:'usb'} },\n    { key:'comms.other', label:'Other interface', type:'text', sub:true, showIf:{k:'comms.interfaces', has:'other'} },\n  ]},\n\n  { id:'display', title:'Display & user interface', desc:'Sensors usually have no display — pick \"None\" if so.', fields:[\n    { key:'ui.display', label:'Display type', type:'select', options:O(['none','None'],['led','LED indicators only'],['segment','Segment LCD'],['tft','TFT LCD'],['oled','OLED'],['epaper','E-paper'],['tbd','TBD']) },\n    { key:'ui.size', label:'Preferred display size', type:'number', unit:'inches', showIf:{k:'ui.display', in:['segment','tft','oled','epaper']} },\n    { key:'ui.orientation', label:'Orientation', type:'select', options:O(['portrait','Portrait'],['landscape','Landscape'],['square','Square / round'],['tbd','TBD']), showIf:{k:'ui.display', in:['segment','tft','oled','epaper']} },\n    { key:'ui.input', label:'User input', type:'multi', options:O(['touchscreen','Touchscreen'],['cap_buttons','Capacitive buttons'],['buttons','Physical buttons'],['knob','Rotary knob'],['none','None']) },\n    { key:'ui.notes', label:'Screen / UX notes', type:'textarea', wide:true, hint:'Key screens, branding, languages, units.' },\n  ]},\n\n  { id:'mech', title:'Form factor & mechanical', desc:'Reuse existing plastics where possible.', fields:[\n    { key:'mech.reuse', label:'Reuse an existing product family\\'s plastics?', type:'ynt' },\n    { key:'mech.family', label:'Product family to reuse', type:'select', options:'@families', showIf:{k:'mech.reuse', eq:'yes'} },\n    { key:'mech.enclosure', label:'Describe enclosure requirements', type:'textarea', wide:true, hint:'Size, shape, look — anything known so far.', showIf:{k:'mech.reuse', in:['no','tbd']} },\n    { key:'mech.mounting', label:'Mounting', type:'multi', wide:true, options:O(['wall_box','Wall (back box)'],['wall_surface','Wall (surface)'],['din','DIN rail'],['duct','Duct'],['ceiling','Ceiling'],['panel','Panel / enclosure'],['other','Other']) },\n    { key:'mech.dimensions', label:'Max dimensions', type:'text', hint:'W × H × D mm' },\n    { key:'mech.ip', label:'Ingress protection', type:'text', hint:'e.g. IP20, IP54' },\n    { key:'mech.cad', label:'Mechanical / CAD file link', type:'text', wide:true, hint:'Link to the mechanical model, used later for the visual mock-up.' },\n  ]},\n\n  { id:'cert', title:'Certification & compliance', desc:'', fields:[\n    { key:'cert.list', label:'Certifications required', type:'multi', wide:true, options:O(['ul','UL'],['fcc','FCC'],['ic','ISED (Canada)'],['ce','CE'],['ukca','UKCA'],['btl','BTL (BACnet)'],['rohs','RoHS'],['reach','REACH'],['bis','BIS (India)'],['tbd','TBD']) },\n    { key:'cert.other', label:'Other certifications / standards', type:'text', wide:true },\n  ]},\n\n  { id:'firmware', title:'Firmware: operation & profiles', desc:'Hardware and firmware are captured together in this one sheet.', fields:[\n    { key:'fw.operation', label:'Operating mode', type:'multi', wide:true, options:O(['standalone','Standalone application'],['ccu','Connected to CCU'],['failsafe','Failsafe-only standalone (when CCU is lost)'],['bms','Integrated with BMS']) },\n    { key:'fw.profiles', label:'Profiles to support', type:'multi', wide:true, options:O(['2pipe','2-pipe FCU'],['4pipe','4-pipe FCU'],['cpu','Conventional package unit'],['hpu','Heat pump unit'],['vav','VAV'],['monitor','Monitoring only'],['other','Other']) },\n    { key:'fw.profiles_other', label:'Other profiles', type:'text', wide:true, showIf:{k:'fw.profiles', has:'other'} },\n    { key:'fw.profile_std', label:'Standard profiles, or exceptions needed?', type:'select', options:O(['standard','Standard as-is'],['exceptions','Exceptions needed'],['tbd','TBD']) },\n    { key:'fw.profile_exceptions', label:'Describe the exceptions', type:'textarea', wide:true, showIf:{k:'fw.profile_std', eq:'exceptions'} },\n  ]},\n\n  { id:'features', title:'Firmware: features', desc:'Yes/no for each capability. Add more rows below as features are agreed.', fields:[\n    { key:'feat.scheduling', label:'Scheduling', type:'multi', wide:true, options:O(['none','Not needed'],['standalone','Standalone (on device)'],['ccu','Via CCU'],['bacnet','Via BACnet']) },\n    { key:'feat.ota', label:'Firmware update (OTA)', type:'multi', wide:true, options:O(['none','Not needed'],['rf','Via RF'],['ble','Via Bluetooth'],['ip','Via Ethernet / IP'],['usb','Via USB / local']) },\n    { key:'feat.lowcode', label:'Low-code (Site Sequencer) support', type:'ynt' },\n    { key:'feat.lowcode_notes', label:'Low-code notes', type:'text', showIf:{k:'feat.lowcode', eq:'yes'} },\n    { key:'feat.custom', label:'Additional features', type:'features', wide:true, hint:'Name each capability and whether it is required.' },\n  ]},\n\n  { id:'mockup', title:'Visual mock-up', phase:'Preview later phase', desc:'Captured now; a rendered virtual product from this spec plus the mechanical file comes in a later phase.', fields:[\n    { key:'mock.wanted', label:'Generate a visual mock-up from this spec?', type:'ynt' },\n    { key:'mock.refs', label:'Reference images / links', type:'textarea', wide:true },\n  ]},\n\n  { id:'boq', title:'BOQ & cost estimate', phase:'Costing later phase', desc:'Once the BOQ list is loaded, the tool will estimate cost and list the parts each requirement pulls in.', fields:[\n    { key:'boq.wanted', label:'Estimate cost from the BOQ?', type:'ynt' },\n    { key:'boq.detail', label:'Level of detail', type:'select', options:O(['summary','Summary (approx. cost + key parts)'],['detailed','Detailed breakdown']), showIf:{k:'boq.wanted', eq:'yes'} },\n    { key:'boq.notes', label:'Costing notes', type:'textarea', wide:true, hint:'Known parts, preferred suppliers, cost constraints.' },\n  ]},\n\n  { id:'mapping', title:'Existing product match', phase:'Matching phase 2', desc:'Phase 2 will compare this spec with existing products and say whether one already fits (with extra profile engineering) or a new product is needed.', fields:[\n    { key:'map.similar', label:'Products you think are close', type:'multi', wide:true, options:'@families' },\n    { key:'map.notes', label:'Why existing products don\\'t fit', type:'textarea', wide:true },\n  ]},\n\n  { id:'notes', title:'Open questions & notes', desc:'', fields:[\n    { key:'notes.open', label:'Open questions', type:'textarea', wide:true },\n    { key:'notes.other', label:'Other notes', type:'textarea', wide:true },\n  ]},\n];\n\n/* ---- Profile sections: one per profile in PROFILES (profiles.js), shown when that profile is selected ---- */\nconst FEATURE_CHOICES = [{v:'std', l:'Standard'}, {v:'chg', l:'Changed'}, {v:'no', l:'Not needed'}];\n(function addProfileSections(){\n  const at = SECTIONS.findIndex(s => s.id === 'firmware') + 1;\n  const extra = Object.entries(PROFILES).map(([pid, p]) => {\n    const when = {k:'fw.profiles', has:pid};\n    const fields = [];\n    for (const entry of p.features){\n      const f = profileFeature(entry);\n      fields.push({ key:`prof.${pid}.${f.id}`, label:f.name, type:'feature', options:FEATURE_CHOICES, wide:true,\n        group:f.group, profile:pid, feature:f.id, showIf:when });\n      fields.push({ key:`prof.${pid}.${f.id}.notes`, label:`${f.name}: what changes?`, type:'textarea', wide:true, sub:true,\n        showIf:[when, {k:`prof.${pid}.${f.id}`, eq:'chg'}] });\n    }\n    fields.push({ key:`prof.${pid}.other`, label:`Other ${p.name} changes or additions`, type:'textarea', wide:true, showIf:when });\n    return { id:`profile_${pid}`, title:`Profile: ${p.name}`, profile:pid,\n      desc:`Shown because ${p.name} is selected. Each feature defaults to Standard; mark only what changes or isn't needed.`, fields };\n  });\n  SECTIONS.splice(at, 0, ...extra);\n})();\n\n\n/* ===================================================================== */\nconst $ = s => document.querySelector(s);\nconst esc = s => String(s ?? '').replace(/[&<>\"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',\"'\":'&#39;'}[c]));\nlet FAMILIES = [];\nlet state = { id:null, data:{}, status:'draft', dirty:false, specs:[] };\n\nfunction toast(msg){ const t=$('#toast'); t.textContent=msg; t.classList.add('show'); clearTimeout(t._h); t._h=setTimeout(()=>t.classList.remove('show'),2200); }\n\nasync function api(path, opts={}){\n  const r = await fetch(path, { ...opts, headers:{'content-type':'application/json', ...(opts.headers||{})}, credentials:'same-origin' });\n  if (r.status === 401){ show('login'); throw new Error('unauthorized'); }\n  const body = r.headers.get('content-type')?.includes('json') ? await r.json() : await r.text();\n  if (!r.ok) throw new Error(body?.error || r.statusText);\n  return body;\n}\n\nfunction show(view){\n  for (const v of ['Login','List','Edit']) $('#view'+v).classList.toggle('hidden', v.toLowerCase()!==view);\n  $('#btnLogout').classList.toggle('hidden', view==='login');\n}\n\n/* ---------- options & visibility ---------- */\nfunction optionsFor(f){\n  if (f.options === '@families') return [...FAMILIES.map(x=>({v:x.id,l:x.name})), {v:'tbd',l:'TBD'}];\n  return f.options || [];\n}\nfunction cond(c, d){\n  const v = d[c.k];\n  if ('eq' in c) return v === c.eq;\n  if ('in' in c) return c.in.includes(v);\n  if ('has' in c) return Array.isArray(v) && v.includes(c.has);\n  if ('gt' in c) return Number(v) > c.gt;\n  return true;\n}\nfunction visible(f, d){ if (!f.showIf) return true; return [].concat(f.showIf).every(c => cond(c, d)); }\n\n/* ---------- render form ---------- */\nfunction renderForm(){\n  const d = state.data;\n  $('#secnav').innerHTML = SECTIONS.map(s => `<a href=\"#sec-${s.id}\">${esc(s.title)}<span class=\"n\" data-count=\"${s.id}\"></span></a>`).join('');\n  $('#form').innerHTML = SECTIONS.map(s => `\n    <section class=\"card\" id=\"sec-${s.id}\">\n      <h2>${esc(s.title)} ${s.phase?`<span class=\"phase\">${esc(s.phase)}</span>`:''}</h2>\n      ${s.desc?`<p class=\"desc\">${esc(s.desc)}</p>`:'<div style=\"height:10px\"></div>'}\n      <div class=\"grid\">${sectionFieldsHTML(s, d)}</div>\n    </section>`).join('');\n  bindForm();\n  refreshVisibility();\n  renderSummary();\n}\n\nfunction sectionFieldsHTML(s, d){\n  let html = '', grp = null;\n  for (const f of s.fields){\n    if (f.group && f.group !== grp){ grp = f.group; html += `<div class=\"grp\" data-grp=\"${esc(s.id)}\">${esc(grp)}</div>`; }\n    html += fieldHTML(f, d);\n  }\n  return html;\n}\nfunction featureDetail(f){\n  const pf = profileFeature(PROFILES[f.profile].features.find(e => (e.id||e) === f.feature));\n  return `<details><summary>Standard behaviour</summary><ul>${pf.behaviour.map(b=>`<li>${esc(b)}</li>`).join('')}</ul>\n    ${pf.tuners.length?`<table>${pf.tuners.map(([n,v])=>`<tr><td>${esc(n)}</td><td>${esc(v)}</td></tr>`).join('')}</table>`:''}\n    ${pf.confirm.length?`<div class=\"confirm\"><b>To confirm:</b><ul>${pf.confirm.map(c=>`<li>${esc(c)}</li>`).join('')}</ul></div>`:''}</details>`;\n}\nfunction fieldHTML(f, d){\n  if (f.type === 'feature'){\n    const v = d[f.key];\n    return `<div class=\"f wide pf\" data-field=\"${f.key}\"><span class=\"lbl\">${esc(f.label)}</span>\n      <div class=\"seg\" data-seg=\"${f.key}\">${f.options.map(o=>`<button type=\"button\" data-v=\"${o.v}\" class=\"${v===o.v?'on':(!v&&o.v==='std'?'dflt':'')}\">${o.l}</button>`).join('')}</div>\n      ${featureDetail(f)}</div>`;\n  }\n  const v = d[f.key];\n  const id = 'f_' + f.key.replace(/\\W/g,'_');\n  const cls = `f${f.wide?' wide':''}${f.sub?' sub':''}`;\n  const unit = f.unit ? ` <span class=\"hint\">(${esc(f.unit)})</span>` : '';\n  const hint = f.hint ? `<span class=\"hint\">${esc(f.hint)}</span>` : '';\n  let input = '';\n  switch (f.type){\n    case 'text': input = `<input type=\"text\" id=\"${id}\" data-k=\"${f.key}\" value=\"${esc(v)}\">`; break;\n    case 'date': input = `<input type=\"date\" id=\"${id}\" data-k=\"${f.key}\" value=\"${esc(v)}\">`; break;\n    case 'number': input = `<input type=\"number\" min=\"0\" step=\"any\" id=\"${id}\" data-k=\"${f.key}\" value=\"${v ?? ''}\">`; break;\n    case 'textarea': input = `<textarea id=\"${id}\" data-k=\"${f.key}\">${esc(v)}</textarea>`; break;\n    case 'select': input = `<select id=\"${id}\" data-k=\"${f.key}\"><option value=\"\">—</option>${optionsFor(f).map(o=>`<option value=\"${esc(o.v)}\"${v===o.v?' selected':''}>${esc(o.l)}</option>`).join('')}</select>`; break;\n    case 'multi': {\n      const arr = Array.isArray(v) ? v : [];\n      input = `<div class=\"chips\" data-multi=\"${f.key}\">${optionsFor(f).map(o=>`<label class=\"${arr.includes(o.v)?'on':''}\"><input type=\"checkbox\" value=\"${esc(o.v)}\"${arr.includes(o.v)?' checked':''}>${esc(o.l)}</label>`).join('')}</div>`;\n      break;\n    }\n    case 'yesno': case 'ynt': {\n      const opts = f.type==='ynt' ? [['yes','Yes'],['no','No'],['tbd','TBD']] : [['yes','Yes'],['no','No']];\n      input = `<div class=\"seg\" data-seg=\"${f.key}\">${opts.map(([ov,ol])=>`<button type=\"button\" data-v=\"${ov}\" class=\"${v===ov?'on':''}\">${ol}</button>`).join('')}</div>`;\n      break;\n    }\n    case 'features': input = `<div data-features=\"${f.key}\"></div><button type=\"button\" class=\"btn\" data-addfeat=\"${f.key}\" style=\"width:max-content\">+ Add feature</button>`; break;\n  }\n  return `<div class=\"${cls}\" data-field=\"${f.key}\"><label class=\"lbl\" for=\"${id}\">${esc(f.label)}${unit}</label>${input}${hint}</div>`;\n}\n\nfunction setVal(k, v){\n  if (v === '' || v === null || v === undefined || (Array.isArray(v) && !v.length)) delete state.data[k];\n  else state.data[k] = v;\n  state.dirty = true; $('#savedAt').textContent = 'Unsaved changes';\n  refreshVisibility(); renderSummary();\n}\n\nfunction bindForm(){\n  const form = $('#form');\n  form.oninput = e => {\n    const el = e.target;\n    if (el.dataset.k){\n      const f = FIELD[el.dataset.k];\n      setVal(el.dataset.k, f.type==='number' ? (el.value===''?'':Number(el.value)) : el.value);\n    } else if (el.closest('[data-multi]') && el.type==='checkbox'){\n      const box = el.closest('[data-multi]');\n      el.parentElement.classList.toggle('on', el.checked);\n      setVal(box.dataset.multi, [...box.querySelectorAll('input:checked')].map(i=>i.value));\n    } else if (el.closest('[data-features]')){\n      readFeatures(el.closest('[data-features]').dataset.features);\n    }\n  };\n  form.onchange = form.oninput;\n  form.onclick = e => {\n    const b = e.target.closest('button'); if (!b) return;\n    const seg = b.closest('[data-seg]');\n    if (seg){\n      const k = seg.dataset.seg, nv = state.data[k]===b.dataset.v ? '' : b.dataset.v;\n      seg.querySelectorAll('button').forEach(x=>{ x.classList.toggle('on', x.dataset.v===nv); x.classList.toggle('dflt', !nv && x.dataset.v==='std' && FIELD[k]?.type==='feature'); });\n      setVal(k, nv);\n    } else if (b.dataset.addfeat){\n      const k = b.dataset.addfeat; const list = (state.data[k]||[]).slice(); list.push({name:'',need:'required',notes:''});\n      state.data[k]=list; drawFeatures(k); state.dirty=true;\n      const rows = document.querySelectorAll(`[data-features=\"${k}\"] .feat`); rows[rows.length-1]?.querySelector('input')?.focus();\n    } else if (b.dataset.delfeat !== undefined){\n      const box = b.closest('[data-features]'); const k = box.dataset.features;\n      const list = (state.data[k]||[]).slice(); list.splice(Number(b.dataset.delfeat),1); setVal(k, list); drawFeatures(k);\n    }\n  };\n  for (const s of SECTIONS) for (const f of s.fields) if (f.type==='features') drawFeatures(f.key);\n}\n\nfunction drawFeatures(k){\n  const box = document.querySelector(`[data-features=\"${k}\"]`); if (!box) return;\n  const list = state.data[k] || [];\n  box.innerHTML = list.map((r,i)=>`<div class=\"feat\">\n    <input placeholder=\"Feature (e.g. Fan modes from BACnet)\" data-fi=\"name\" value=\"${esc(r.name)}\">\n    <select data-fi=\"need\">${[['required','Required'],['nice','Nice to have'],['no','Not needed'],['tbd','TBD']].map(([v,l])=>`<option value=\"${v}\"${r.need===v?' selected':''}>${l}</option>`).join('')}</select>\n    <input placeholder=\"Notes\" data-fi=\"notes\" value=\"${esc(r.notes)}\">\n    <button type=\"button\" class=\"btn ghost\" data-delfeat=\"${i}\" title=\"Remove\">✕</button></div>`).join('');\n}\nfunction readFeatures(k){\n  const rows = [...document.querySelectorAll(`[data-features=\"${k}\"] .feat`)].map(r=>({\n    name:r.querySelector('[data-fi=name]').value, need:r.querySelector('[data-fi=need]').value, notes:r.querySelector('[data-fi=notes]').value }));\n  setVal(k, rows);\n}\n\nfunction refreshVisibility(){\n  for (const s of SECTIONS){\n    let filled = 0, total = 0;\n    for (const f of s.fields){\n      const vis = visible(f, state.data);\n      document.querySelector(`[data-field=\"${f.key}\"]`)?.classList.toggle('hidden', !vis);\n      if (vis){ total++; if (state.data[f.key] !== undefined) filled++; }\n    }\n    const n = document.querySelector(`[data-count=\"${s.id}\"]`); if (n) n.textContent = `${filled}/${total}`;\n    document.getElementById('sec-'+s.id)?.classList.toggle('hidden', total === 0);\n    document.querySelector(`#secnav a[href=\"#sec-${s.id}\"]`)?.classList.toggle('hidden', total === 0);\n    document.querySelectorAll(`[data-grp=\"${s.id}\"]`).forEach(g => g.classList.toggle('hidden', total === 0));\n  }\n  $('#edTitle').textContent = state.data['overview.title'] || 'New requirement';\n}\n\n/* only keep answers for questions that are currently visible */\nfunction prunedData(){\n  const out = {};\n  for (const s of SECTIONS) for (const f of s.fields){\n    if (!visible(f, state.data)) continue;\n    let v = state.data[f.key];\n    if (f.type==='features' && Array.isArray(v)) v = v.filter(r => r.name && r.name.trim());\n    if (v === undefined || v === '' || (Array.isArray(v) && !v.length)) continue;\n    out[f.key] = v;\n  }\n  return out;\n}\n\n/* ---------- summary + device sketch ---------- */\nfunction label(k, v){\n  const f = FIELD[k]; if (!f) return v;\n  const opts = optionsFor(f);\n  const one = x => opts.find(o=>o.v===x)?.l ?? (x==='yes'?'Yes':x==='no'?'No':x==='tbd'?'TBD':x);\n  if (f.type==='feature') return one(v);\n  return Array.isArray(v) ? v.map(one).join(', ') : one(v);\n}\nfunction deviceSVG(d){\n  const disp = d['ui.display'], size = Number(d['ui.size'])||0, orient = d['ui.orientation'];\n  let w = 120, h = 120;\n  if (orient==='portrait'){ w=96; h=140; } else if (orient==='landscape'){ w=150; h=100; }\n  const hasScreen = ['segment','tft','oled','epaper'].includes(disp);\n  const sw = w*0.72, sh = hasScreen ? Math.min(h*0.55, sw*(orient==='portrait'?1.3:orient==='landscape'?0.6:0.8)) : 0;\n  const leds = disp==='led';\n  const screenFill = disp==='tft'?'#1d3557':disp==='oled'?'#0b0b0b':disp==='epaper'?'#e9e7df':'#c9d6c3';\n  const pir = (d['sensing.onboard']||[]).includes('pir');\n  return `<svg width=\"${w+20}\" height=\"${h+20}\" viewBox=\"-10 -10 ${w+20} ${h+20}\" aria-label=\"Rough device sketch\">\n    <rect x=\"0\" y=\"0\" width=\"${w}\" height=\"${h}\" rx=\"14\" fill=\"#fbfcfd\" stroke=\"#c4ccd6\" stroke-width=\"2\"/>\n    ${hasScreen?`<rect x=\"${(w-sw)/2}\" y=\"${h*0.14}\" width=\"${sw}\" height=\"${sh}\" rx=\"5\" fill=\"${screenFill}\"/>\n      <text x=\"${w/2}\" y=\"${h*0.14+sh/2+5}\" text-anchor=\"middle\" font-size=\"13\" fill=\"${disp==='epaper'||disp==='segment'?'#33402f':'#e8f0fb'}\" font-family=\"system-ui\">${disp==='segment'?'72°':'72°F'}</text>`:''}\n    ${leds?`<circle cx=\"${w/2-12}\" cy=\"${h*0.3}\" r=\"4\" fill=\"#2bb673\"/><circle cx=\"${w/2}\" cy=\"${h*0.3}\" r=\"4\" fill=\"#f5a524\"/><circle cx=\"${w/2+12}\" cy=\"${h*0.3}\" r=\"4\" fill=\"#c4ccd6\"/>`:''}\n    ${pir?`<circle cx=\"${w/2}\" cy=\"${h-18}\" r=\"7\" fill=\"#eef1f5\" stroke=\"#c4ccd6\"/>`:''}\n    ${size?`<text x=\"${w/2}\" y=\"${h+8}\" text-anchor=\"middle\" font-size=\"10\" fill=\"#5d6b7e\" font-family=\"system-ui\">${size}\" ${esc(orient||'')}</text>`:''}\n  </svg>`;\n}\nfunction renderSummary(){\n  const d = prunedData();\n  const n = k => Number(d[k])||0;\n  const io = [['Relays','io.relays'],['AO','io.analog_outputs'],['AI','io.analog_inputs'],['UI','io.universal_inputs'],['DI','io.digital_inputs']]\n    .filter(([,k])=>n(k)).map(([l,k])=>`${n(k)} ${l}`).join(' · ') || '—';\n  const protos = ['comms.rs485.protocols','comms.ethernet.protocols','comms.wifi.protocols'].flatMap(k => (d[k]||[]).map(v => label(k,[v]))).filter(x=>x!=='Other');\n  const rows = [\n    ['Type', d['overview.product_type'] ? label('overview.product_type', d['overview.product_type']) : '—'],\n    ['I/O', io],\n    ['Interfaces', d['comms.interfaces'] ? label('comms.interfaces', d['comms.interfaces']) : '—'],\n    ['Protocols', [...new Set(protos)].join(', ') || '—'],\n    ['Display', d['ui.display'] ? label('ui.display', d['ui.display']) + (d['ui.size']?`, ${d['ui.size']}\"`:'') : '—'],\n    ['Plastics', d['mech.reuse']==='yes' ? (d['mech.family']?label('mech.family',d['mech.family']):'Reuse (family?)') : d['mech.reuse'] ? label('mech.reuse', d['mech.reuse']) : '—'],\n    ['Profiles', d['fw.profiles'] ? label('fw.profiles', d['fw.profiles']) : '—'],\n    ...Object.entries(PROFILES).filter(([pid]) => (d['fw.profiles']||[]).includes(pid)).map(([pid,p]) => {\n      const vals = Object.entries(d).filter(([k]) => k.startsWith(`prof.${pid}.`) && !k.endsWith('.notes') && k !== `prof.${pid}.other`).map(([,v])=>v);\n      const c = vals.filter(v=>v==='chg').length, no = vals.filter(v=>v==='no').length;\n      return [p.name, c||no ? `${c} changed, ${no} not needed` : 'Standard'];\n    }),\n    ['Low-code', d['feat.lowcode'] ? label('feat.lowcode', d['feat.lowcode']) : '—'],\n    ['Certs', d['cert.list'] ? label('cert.list', d['cert.list']) : '—'],\n  ];\n  $('#summary').innerHTML = `<h3>Spec at a glance</h3>\n    <div class=\"device\">${deviceSVG(d)}</div>\n    <dl class=\"kv\">${rows.map(([k,v])=>`<dt>${k}</dt><dd>${esc(v)}</dd>`).join('')}</dl>\n    <h3>Later phases</h3>\n    <div class=\"hint\" style=\"color:var(--muted);font-size:12px\">Product match, BOQ cost and full visual mock-up will appear here.</div>`;\n}\n\n/* ---------- export ---------- */\n/* Export document model -> Markdown and HTML (HTML pastes into OneNote with formatting). */\nfunction buildDoc(){\n  const d = prunedData(), B = [];\n  const h = (level, text) => B.push({h:level, text}), p = text => B.push({p:text}), ul = items => items.length && B.push({ul:items}), table = (head, rows) => rows.length && B.push({table:{head, rows}});\n  h(1, d['overview.title'] || 'Untitled requirement');\n  p(`Status: ${($('#status').value||state.status).replace('_',' ')}${d['overview.requested_by']?` · Requested by ${d['overview.requested_by']}`:''} · Exported ${new Date().toLocaleDateString()}`);\n  for (const s of SECTIONS){\n    if (s.profile){\n      if (!(d['fw.profiles']||[]).includes(s.profile)) continue;\n      const P = PROFILES[s.profile];\n      h(2, s.title); p(P.summary); p(`Typical I/O: ${P.typicalIO}`);\n      h(3, 'Default port mapping'); table(['Port','Default function'], P.ports);\n      h(3, 'Configurable options'); table(['Port type','Options'], P.options);\n      let grp = null; const notNeeded = [];\n      for (const entry of P.features){\n        const f = profileFeature(entry), v = d[`prof.${s.profile}.${f.id}`] || 'std';\n        if (v === 'no'){ notNeeded.push(f.name); continue; }\n        if (f.group !== grp){ grp = f.group; h(3, grp); }\n        h(4, `${f.name} — ${v==='chg'?'CHANGED':'Standard'}`);\n        if (v === 'chg') B.push({change: d[`prof.${s.profile}.${f.id}.notes`] || '(change not described yet)'});\n        ul(f.behaviour);\n        table(['Tuner / parameter','Default'], f.tuners);\n        if (f.confirm.length){ B.push({p:'To confirm:', em:true}); ul(f.confirm); }\n      }\n      if (notNeeded.length){ h(3, 'Not needed'); ul(notNeeded); }\n      if (d[`prof.${s.profile}.other`]){ h(3, 'Other changes or additions'); p(d[`prof.${s.profile}.other`]); }\n      continue;\n    }\n    const lines = [];\n    for (const f of s.fields){\n      if (!(f.key in d)) continue;\n      const v = d[f.key];\n      if (f.type==='features') v.forEach(r => lines.push(`${r.name} — ${({required:'Required',nice:'Nice to have',no:'Not needed',tbd:'TBD'})[r.need]}${r.notes?` (${r.notes})`:''}`));\n      else lines.push(`${f.label}${f.unit?` (${f.unit})`:''}: ${['text','textarea','date','number'].includes(f.type) ? v : label(f.key, v)}`);\n    }\n    if (lines.length){ h(2, s.title); ul(lines); }\n  }\n  return B;\n}\nfunction toMarkdown(){\n  return buildDoc().map(b => {\n    if (b.h) return `${'#'.repeat(b.h)} ${b.text}`;\n    if (b.change) return `> **Change:** ${b.change}`;\n    if (b.p) return b.em ? `*${b.p}*` : b.p;\n    if (b.ul) return b.ul.map(x => `- ${x}`).join('\\n');\n    if (b.table) return [`| ${b.table.head.join(' | ')} |`, `|${b.table.head.map(()=>'---').join('|')}|`, ...b.table.rows.map(r => `| ${r.map(c=>String(c).replace(/\\|/g,'\\\\|')).join(' | ')} |`)].join('\\n');\n  }).join('\\n\\n') + '\\n';\n}\nfunction toHTML(){\n  const td = 'border:1px solid #c4ccd6;padding:3px 8px;vertical-align:top;';\n  const body = buildDoc().map(b => {\n    if (b.h) return `<h${b.h}>${esc(b.text)}</h${b.h}>`;\n    if (b.change) return `<p style=\"background:#fff4e0;padding:4px 8px\"><b>Change:</b> ${esc(b.change)}</p>`;\n    if (b.p) return b.em ? `<p><i>${esc(b.p)}</i></p>` : `<p>${esc(b.p)}</p>`;\n    if (b.ul) return `<ul>${b.ul.map(x=>`<li>${esc(x)}</li>`).join('')}</ul>`;\n    if (b.table) return `<table style=\"border-collapse:collapse\"><tr>${b.table.head.map(c=>`<th style=\"${td}background:#eef1f5;text-align:left\">${esc(c)}</th>`).join('')}</tr>${b.table.rows.map(r=>`<tr>${r.map(c=>`<td style=\"${td}\">${esc(c)}</td>`).join('')}</tr>`).join('')}</table>`;\n  }).join('\\n');\n  return `<div style=\"font-family:Calibri,Segoe UI,sans-serif;font-size:11pt\">${body}</div>`;\n}\nasync function copyForOneNote(){\n  const html = toHTML(), text = toMarkdown();\n  try {\n    await navigator.clipboard.write([new ClipboardItem({ 'text/html': new Blob([html], {type:'text/html'}), 'text/plain': new Blob([text], {type:'text/plain'}) })]);\n    toast('Copied — paste into a OneNote page');\n  } catch {\n    const div = document.createElement('div'); div.innerHTML = html; div.style.position='fixed'; div.style.left='-9999px'; document.body.appendChild(div);\n    const r = document.createRange(); r.selectNodeContents(div); const sel = getSelection(); sel.removeAllRanges(); sel.addRange(r);\n    const ok = document.execCommand('copy'); sel.removeAllRanges(); div.remove();\n    toast(ok ? 'Copied — paste into a OneNote page' : 'Copy failed — use .md instead');\n  }\n}\nfunction download(name, text, type){\n  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text],{type})); a.download = name; a.click(); setTimeout(()=>URL.revokeObjectURL(a.href), 1000);\n}\n\n/* ---------- list ---------- */\nasync function loadList(){\n  show('list');\n  state.specs = (await api('/api/specs')).specs;\n  drawList();\n}\nfunction drawList(){\n  const q = $('#search').value.trim().toLowerCase();\n  const rows = state.specs.filter(s => !q || [s.title,s.requested_by,s.product_type,s.status].join(' ').toLowerCase().includes(q));\n  if (!state.specs.length){ $('#listWrap').innerHTML = `<div class=\"empty\">No requirements yet. Click <b>+ New requirement</b> to capture the first one.</div>`; return; }\n  $('#listWrap').innerHTML = `<table class=\"list\"><thead><tr><th>Name</th><th>Type</th><th>Requested by</th><th>Status</th><th>Updated</th></tr></thead><tbody>\n    ${rows.map(s=>`<tr class=\"row\" data-id=\"${esc(s.id)}\"><td><b>${esc(s.title)}</b></td><td>${esc(label('overview.product_type', s.product_type)||'—')}</td><td>${esc(s.requested_by||'—')}</td><td><span class=\"pill ${esc(s.status)}\">${esc(s.status.replace('_',' '))}</span></td><td>${esc(fmtDate(s.updated_at))}</td></tr>`).join('')}\n  </tbody></table>`;\n}\nfunction fmtDate(s){ if(!s) return ''; const d = new Date(s.replace(' ','T')+'Z'); return isNaN(d)? s : d.toLocaleString(undefined,{dateStyle:'medium',timeStyle:'short'}); }\n\n/* ---------- editor ---------- */\nasync function openSpec(id){\n  if (id){\n    const r = await api('/api/specs/'+encodeURIComponent(id));\n    state.id = r.spec.id; state.data = r.spec.data; state.status = r.spec.status;\n    $('#savedAt').textContent = 'Saved ' + fmtDate(r.spec.updated_at);\n  } else {\n    state.id = null; state.data = {}; state.status = 'draft'; $('#savedAt').textContent = '';\n  }\n  state.dirty = false; $('#status').value = state.status;\n  show('edit'); renderForm(); window.scrollTo(0,0);\n  history.replaceState(null,'', id ? '#spec/'+id : '#new');\n}\nasync function save(){\n  const data = prunedData();\n  if (!data['overview.title']){ toast('Give the requirement a name first'); $('#f_overview_title')?.focus(); return; }\n  const body = JSON.stringify({ data, status: $('#status').value });\n  const r = state.id ? await api('/api/specs/'+encodeURIComponent(state.id), {method:'PUT', body}) : await api('/api/specs', {method:'POST', body});\n  state.id = r.spec.id; state.dirty = false; state.status = r.spec.status;\n  $('#savedAt').textContent = 'Saved ' + fmtDate(r.spec.updated_at);\n  history.replaceState(null,'', '#spec/'+state.id);\n  toast('Saved');\n}\n\n/* ---------- wiring ---------- */\nconst FIELD = Object.fromEntries(SECTIONS.flatMap(s => s.fields.map(f => [f.key, f])));\n\n$('#loginForm').onsubmit = async e => {\n  e.preventDefault(); $('#loginErr').textContent = '';\n  try { await api('/api/login', {method:'POST', body: JSON.stringify({password: $('#pw').value})}); $('#pw').value=''; boot(); }\n  catch(err){ $('#loginErr').textContent = err.message==='unauthorized' ? 'Wrong password' : err.message; show('login'); }\n};\n$('#btnLogout').onclick = async () => { await fetch('/api/logout',{method:'POST'}); show('login'); };\n$('#btnNew').onclick = () => openSpec(null);\n$('#btnBack').onclick = () => { if (state.dirty && !confirmLeave()) return; history.replaceState(null,'','#'); loadList(); };\n$('#btnSave').onclick = () => save().catch(e => toast('Save failed: '+e.message));\n$('#status').onchange = () => { state.dirty = true; $('#savedAt').textContent = 'Unsaved changes'; };\n$('#search').oninput = drawList;\n$('#listWrap').onclick = e => { const tr = e.target.closest('tr.row'); if (tr) openSpec(tr.dataset.id); };\nconst fileName = () => (prunedData()['overview.title']||'requirement').replace(/[^\\w-]+/g,'_');\n$('#btnCopyOneNote').onclick = () => copyForOneNote();\n$('#btnExportMd').onclick = () => download(fileName()+'.md', toMarkdown(), 'text/markdown');\n$('#btnExportJson').onclick = () => download(fileName()+'.json', JSON.stringify({status:$('#status').value, data:prunedData()}, null, 2), 'application/json');\nfunction confirmLeave(){ return window.confirm('You have unsaved changes. Leave without saving?'); }\nwindow.addEventListener('beforeunload', e => { if (state.dirty){ e.preventDefault(); e.returnValue=''; } });\ndocument.addEventListener('keydown', e => { if ((e.ctrlKey||e.metaKey) && e.key==='s' && !$('#viewEdit').classList.contains('hidden')){ e.preventDefault(); $('#btnSave').click(); } });\n\nasync function boot(){\n  try {\n    FAMILIES = (await api('/api/families')).families;\n    const m = location.hash.match(/^#spec\\/(.+)$/);\n    if (m) await openSpec(decodeURIComponent(m[1]));\n    else if (location.hash === '#new') await openSpec(null);\n    else await loadList();\n  } catch(e){ if (e.message!=='unauthorized') toast(e.message); }\n}\nboot();\n</script>\n</body>\n</html>\n";
const SCHEMA = "-- Product Spec Configurator — D1 schema (Phase 1)\n-- Run once in the Cloudflare dashboard: D1 > product-spec-db > Console, paste and Execute.\n-- Safe to re-run: every statement uses IF NOT EXISTS / INSERT OR IGNORE.\n\n-- One row per requirement sheet. The full answers live in `data` (JSON),\n-- so new questions can be added to the form without a migration.\nCREATE TABLE IF NOT EXISTS specs (\n  id            TEXT PRIMARY KEY,\n  title         TEXT NOT NULL,\n  product_type  TEXT,\n  product_family TEXT,\n  status        TEXT NOT NULL DEFAULT 'draft',   -- draft | submitted | in_review | approved | archived\n  requested_by  TEXT,\n  data          TEXT NOT NULL,                   -- JSON: { fieldKey: value, ... }\n  schema_version INTEGER NOT NULL DEFAULT 1,\n  created_at    TEXT NOT NULL DEFAULT (datetime('now')),\n  updated_at    TEXT NOT NULL DEFAULT (datetime('now'))\n);\nCREATE INDEX IF NOT EXISTS idx_specs_updated ON specs(updated_at DESC);\n\n-- Flattened copy of every answer (one row per field / per selected option).\n-- Rewritten on each save. This is the pipeline for Phase 2 product matching\n-- and BOQ costing: both can query \"which specs/products need X\" with plain SQL.\nCREATE TABLE IF NOT EXISTS spec_values (\n  spec_id   TEXT NOT NULL REFERENCES specs(id) ON DELETE CASCADE,\n  section   TEXT NOT NULL,\n  key       TEXT NOT NULL,        -- e.g. comms.rs485.protocols\n  value     TEXT,                 -- e.g. bacnet_mstp   (multi-selects get one row per option)\n  num_value REAL                  -- numeric answers (I/O counts, sizes) for range comparisons\n);\nCREATE INDEX IF NOT EXISTS idx_spec_values_key ON spec_values(key, value);\nCREATE INDEX IF NOT EXISTS idx_spec_values_spec ON spec_values(spec_id);\n\n-- Edit history: previous version of `data` each time a spec is saved.\nCREATE TABLE IF NOT EXISTS spec_history (\n  spec_id    TEXT NOT NULL,\n  data       TEXT NOT NULL,\n  status     TEXT,\n  saved_at   TEXT NOT NULL DEFAULT (datetime('now'))\n);\nCREATE INDEX IF NOT EXISTS idx_spec_history_spec ON spec_history(spec_id, saved_at DESC);\n\n-- Product families offered in the \"reuse plastics / product family\" dropdown.\n-- PLACEHOLDERS: edit names and details to match the real product line.\nCREATE TABLE IF NOT EXISTS product_families (\n  id          TEXT PRIMARY KEY,\n  name        TEXT NOT NULL,\n  notes       TEXT,\n  sort_order  INTEGER DEFAULT 100,\n  active      INTEGER NOT NULL DEFAULT 1\n);\nINSERT OR IGNORE INTO product_families (id, name, notes, sort_order) VALUES\n  ('omnistat',  'OmniStat',       'Placeholder — confirm enclosure / plastics details', 10),\n  ('mystat',    'MyStat',         'Placeholder', 20),\n  ('verosense', 'VeroSense',      'Placeholder', 30),\n  ('smartnode', 'Smart Node',     'Placeholder', 40),\n  ('ccu',       'CCU',            'Placeholder', 50),\n  ('connect',   'Connect Module', 'Placeholder', 60);\n\n-- ---------- Phase 2: product matching (tables created now, left empty) ----------\nCREATE TABLE IF NOT EXISTS products (\n  id          TEXT PRIMARY KEY,\n  name        TEXT NOT NULL,\n  family_id   TEXT REFERENCES product_families(id),\n  status      TEXT DEFAULT 'active',   -- active | eol | in_development\n  notes       TEXT\n);\n-- Same key/value shape as spec_values, so matching is a join on (key, value).\nCREATE TABLE IF NOT EXISTS product_capabilities (\n  product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,\n  key        TEXT NOT NULL,\n  value      TEXT,\n  num_value  REAL\n);\nCREATE INDEX IF NOT EXISTS idx_product_caps_key ON product_capabilities(key, value);\n\n-- ---------- Phase 3: BOQ costing (created now, left empty) ----------\nCREATE TABLE IF NOT EXISTS boq_items (\n  part_no     TEXT PRIMARY KEY,\n  description TEXT NOT NULL,\n  category    TEXT,          -- e.g. relay, mcu, display, radio, plastics\n  unit_cost   REAL,\n  currency    TEXT DEFAULT 'USD',\n  supplier    TEXT,\n  updated_at  TEXT DEFAULT (datetime('now'))\n);\n-- Which BOQ parts a requirement pulls in, e.g. key=comms.interfaces value=rs485 -> transceiver part.\nCREATE TABLE IF NOT EXISTS boq_feature_map (\n  key       TEXT NOT NULL,\n  value     TEXT,\n  part_no   TEXT NOT NULL REFERENCES boq_items(part_no),\n  qty_rule  TEXT DEFAULT '1'   -- '1', or a field key like 'io.relays' meaning \"qty = that count\"\n);\n";
let schemaReady = null; // creates tables on first request (safe to repeat)

// ---- shared form definition (src/form.js, inlined at build) ----
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
    { key:'overview.problem', label:'Customer problem / use case', type:'textarea', wide:true, hint:'Who needs it, what job it does, what exists today.' },
    { key:'overview.regions', label:'Target regions', type:'multi', wide:true, options:O(['na','North America'],['eu','Europe'],['uk','UK'],['in','India'],['mea','Middle East & Africa'],['apac','Asia Pacific'],['latam','Latin America']) },
    { key:'overview.volume', label:'Expected annual volume', type:'number', unit:'units' },
    { key:'overview.target_cost', label:'Target BOM cost', type:'number', unit:'USD' },
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
    { key:'fw.profiles', label:'Profiles to support', type:'multi', wide:true, options:O(['2pipe','2-pipe FCU'],['4pipe','4-pipe FCU'],['cpu','Conventional package unit'],['hpu','Heat pump unit'],['vav','VAV'],['monitor','Monitoring only'],['other','Other']) },
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
    for (const entry of p.features){
      const f = profileFeature(entry);
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



const COOKIE = 'psc_session';
const SESSION_DAYS = 30;
const enc = new TextEncoder();

export default {
  async fetch(req, env) {
    try {
      return await route(req, env);
    } catch (err) {
      console.error(err);
      return json({ error: 'Server error: ' + (err.message || err) }, 500);
    }
  },
};

async function route(req, env) {
  const url = new URL(req.url);
  const path = url.pathname;
  const method = req.method;

  if (path.startsWith('/.well-known/')) return json({ error: 'Not found' }, 404); // no OAuth discovery: token-in-URL auth

  if (path === '/mcp' || path.startsWith('/mcp/')) {
    if (!env.DB) return json({ error: 'D1 binding "DB" is not set' }, 500);
    schemaReady ??= ensureSchema(env).catch(e => { schemaReady = null; throw e; });
    await schemaReady;
    return handleMcp(req, env, url);
  }

  if (!path.startsWith('/api/')) {
    return new Response(HTML, { headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store', ...securityHeaders() } });
  }

  if (!env.ACCESS_PASSWORD) return json({ error: 'ACCESS_PASSWORD secret is not set on this Worker' }, 500);
  if (!env.DB) return json({ error: 'D1 binding "DB" is not set on this Worker' }, 500);
  schemaReady ??= ensureSchema(env).catch(e => { schemaReady = null; throw e; });
  await schemaReady;

  // ---- auth ----
  if (path === '/api/login' && method === 'POST') {
    const { password } = await req.json().catch(() => ({}));
    if (!(await safeEqual(String(password || ''), env.ACCESS_PASSWORD, env))) {
      await new Promise(r => setTimeout(r, 600)); // slow down guessing
      return json({ error: 'Wrong password' }, 401);
    }
    const exp = Date.now() + SESSION_DAYS * 864e5;
    const token = `${exp}.${await sign(String(exp), env)}`;
    return json({ ok: true }, 200, { 'set-cookie': cookie(token, SESSION_DAYS * 86400, url) });
  }
  if (path === '/api/logout' && method === 'POST') {
    return json({ ok: true }, 200, { 'set-cookie': cookie('', 0, url) });
  }
  if (!(await authed(req, env))) return json({ error: 'unauthorized' }, 401);

  // ---- data ----
  if (path === '/api/families' && method === 'GET') {
    const { results } = await env.DB.prepare('SELECT id, name, notes FROM product_families WHERE active = 1 ORDER BY sort_order, name').all();
    return json({ families: results });
  }

  if (path === '/api/specs' && method === 'GET') {
    const { results } = await env.DB.prepare(
      'SELECT id, title, product_type, product_family, status, requested_by, created_at, updated_at FROM specs ORDER BY updated_at DESC LIMIT 500'
    ).all();
    return json({ specs: results });
  }

  if (path === '/api/specs' && method === 'POST') {
    const body = await readSpecBody(req);
    if (body.error) return json(body, 400);
    return json({ spec: await saveSpec(env, null, body.data, body.status) }, 201);
  }

  const m = path.match(/^\/api\/specs\/([\w-]+)(\/history)?$/);
  if (m) {
    const id = m[1];
    const existing = await env.DB.prepare('SELECT id, data, status FROM specs WHERE id = ?').bind(id).first();
    if (!existing) return json({ error: 'Not found' }, 404);

    if (m[2] && method === 'GET') {
      const { results } = await env.DB.prepare('SELECT status, saved_at, data FROM spec_history WHERE spec_id = ? ORDER BY saved_at DESC LIMIT 50').bind(id).all();
      return json({ history: results.map(h => ({ ...h, data: JSON.parse(h.data) })) });
    }
    if (method === 'GET') return json({ spec: await getSpec(env, id) });

    if (method === 'PUT') {
      const body = await readSpecBody(req);
      if (body.error) return json(body, 400);
      return json({ spec: await saveSpec(env, id, body.data, body.status, existing) });
    }

    if (method === 'DELETE') {
      await env.DB.batch([
        env.DB.prepare('DELETE FROM spec_values WHERE spec_id = ?').bind(id),
        env.DB.prepare('DELETE FROM spec_history WHERE spec_id = ?').bind(id),
        env.DB.prepare('DELETE FROM specs WHERE id = ?').bind(id),
      ]);
      return json({ ok: true });
    }
  }

  return json({ error: 'Not found' }, 404);
}

// ---------------- saving (shared by the page and MCP) ----------------
async function saveSpec(env, id, data, status, existing) {
  const row = specColumns({ data, status });
  if (!id) {
    id = newId();
    await env.DB.batch([
      env.DB.prepare('INSERT INTO specs (id, title, product_type, product_family, status, requested_by, data) VALUES (?,?,?,?,?,?,?)')
        .bind(id, row.title, row.product_type, row.product_family, row.status, row.requested_by, row.data),
      ...flattenStatements(env, id, data),
    ]);
  } else {
    await env.DB.batch([
      env.DB.prepare('INSERT INTO spec_history (spec_id, data, status) VALUES (?,?,?)').bind(id, existing.data, existing.status),
      env.DB.prepare(`UPDATE specs SET title=?, product_type=?, product_family=?, status=?, requested_by=?, data=?, updated_at=datetime('now') WHERE id=?`)
        .bind(row.title, row.product_type, row.product_family, row.status, row.requested_by, row.data, id),
      env.DB.prepare('DELETE FROM spec_values WHERE spec_id = ?').bind(id),
      ...flattenStatements(env, id, data),
    ]);
  }
  return getSpec(env, id);
}

// ---------------- MCP (ChatGPT plugin / Claude connector) ----------------
const MCP_VERSIONS = ['2025-11-25', '2025-06-18', '2025-03-26', '2024-11-05'];
const FIELDS = Object.fromEntries(SECTIONS.flatMap(s => s.fields.map(f => [f.key, { ...f, section: s.id }])));

const INTERVIEW_GUIDE = `You are interviewing a product manager to capture a new product requirement for the Product Spec Configurator (building-automation hardware: thermostats, sensors, controllers, I/O modules).
Workflow:
1. Call get_spec_form first. It lists every question (key, label, type, allowed option values, and showIf conditions). Ask only questions whose showIf conditions are met by answers so far.
2. Ask whether to start a new requirement or continue one (list_specs / get_spec).
3. Go section by section in form order. Ask one short question at a time (this often runs in voice). For multi-selects, read out the options briefly. Accept "skip", "not sure" (use tbd where allowed) and move on.
4. Follow branches: e.g. RS-485 selected -> ask its protocols; Modbus RTU -> ask role; display other than none/LED -> ask size and orientation; reuse plastics = yes -> ask which family, no/tbd -> ask for an enclosure description.
5. Map spoken answers to the exact option values from get_spec_form. If an answer is ambiguous or doesn't fit (e.g. a thermostat described as a sensor, conflicting numbers), ask a clarifying question; never guess.
6. Save progress with save_spec after each section (merge=true), so nothing is lost if the call drops. The first save needs overview.title.
7. When a profile with its own section is selected (e.g. 2-pipe or 4-pipe FCU), call get_profile. Walk through it group by group: give a one-line summary of the group's features and ask "standard, or anything to change or drop?". Record only exceptions: prof.<profile>.<feature> = chg with prof.<profile>.<feature>.notes, or = no. Unanswered features count as Standard. Mention "to confirm" items only if the user asks.
8. Features that are not in the form go into feat.custom as {name, need: required|nice|no|tbd, notes}.
9. At the end, read back a short summary, ask for corrections, set status to "submitted" if the user agrees, and give them the page link returned by save_spec.`;

const TOOLS = [
  { name: 'get_spec_form',
    description: 'Use this first in every requirements interview. Returns all sections and questions of the product requirement form: field keys, labels, types, allowed option values and showIf conditions (which earlier answers make a question relevant).',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    annotations: { readOnlyHint: true, title: 'Get requirement form' } },
  { name: 'get_profile',
    description: 'Use this when a control profile (e.g. 2-pipe or 4-pipe FCU) is selected, before asking about its features. Returns the profile summary, default port mapping and each reusable feature with its standard behaviour, tuner defaults and open points.',
    inputSchema: { type: 'object', properties: { profile: { type: 'string', enum: Object.keys(PROFILES), description: 'Profile id as used in fw.profiles' } }, required: ['profile'], additionalProperties: false },
    annotations: { readOnlyHint: true, title: 'Get profile' } },
  { name: 'list_specs',
    description: 'Use this when the user wants to continue, review or find an existing product requirement. Returns saved requirements (id, title, status, last updated), newest first.',
    inputSchema: { type: 'object', properties: { search: { type: 'string', description: 'Optional text to filter by title or requester' } }, additionalProperties: false },
    annotations: { readOnlyHint: true, title: 'List requirements' } },
  { name: 'get_spec',
    description: 'Use this to load one saved requirement with all its answers, e.g. to continue an interview or summarise it.',
    inputSchema: { type: 'object', properties: { id: { type: 'string', description: 'Requirement id from list_specs or save_spec' } }, required: ['id'], additionalProperties: false },
    annotations: { readOnlyHint: true, title: 'Get requirement' } },
  { name: 'save_spec',
    description: 'Use this to save answers to a product requirement. Omit id to create a new one (answers must then include overview.title). With merge=true (default) only the given keys change; pass null for a key to clear it. Values must use field keys and option values from get_spec_form. Returns the saved requirement, any rejected answers with reasons, the questions still unanswered, and a link to the page.',
    inputSchema: { type: 'object', properties: {
      id: { type: 'string', description: 'Existing requirement id; omit to create a new one' },
      answers: { type: 'object', additionalProperties: true, description: 'Map of field key -> value. text/textarea/date: string; number: number; select: one option value; multi: array of option values; ynt: "yes" | "no" | "tbd"; features: array of {name, need, notes}' },
      status: { type: 'string', enum: ['draft', 'submitted', 'in_review', 'approved', 'archived'], description: 'Defaults to the current status (draft for new)' },
      merge: { type: 'boolean', description: 'Merge with saved answers (default true). false replaces all answers.' } },
      required: ['answers'], additionalProperties: false },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, title: 'Save requirement' } },
];

async function handleMcp(req, env, url) {
  const token = url.pathname.slice(5);
  if (!env.MCP_TOKEN) return json({ error: 'MCP is not enabled: set the MCP_TOKEN secret on this Worker' }, 503);
  if (!(await safeEqual(token, env.MCP_TOKEN, env))) return json({ error: 'Not found' }, 404);
  if (req.method === 'GET' && !(req.headers.get('accept') || '').includes('text/event-stream')) {
    // Opening the URL in a browser: quick health check
    return json({ ok: true, mcp: 'ready', server: 'product-spec-configurator', tools: TOOLS.map(t => t.name) });
  }
  if (req.method === 'GET' || req.method === 'DELETE' || req.method === 'HEAD') return new Response(null, { status: 405, headers: { allow: 'POST' } });
  if (req.method !== 'POST') return new Response(null, { status: 405 });

  const msg = await req.json().catch(() => null);
  if (!msg) return json({ jsonrpc: '2.0', id: null, error: { code: -32700, message: 'Parse error' } }, 400);
  if (Array.isArray(msg)) {
    const out = (await Promise.all(msg.map(m => mcpMessage(m, env, url)))).filter(Boolean);
    return out.length ? json(out) : new Response(null, { status: 202 });
  }
  const res = await mcpMessage(msg, env, url);
  return res ? json(res) : new Response(null, { status: 202 });
}

async function mcpMessage(msg, env, url) {
  const { id, method, params = {} } = msg || {};
  const isNotification = id === undefined || id === null;
  const ok = result => isNotification ? null : { jsonrpc: '2.0', id, result };
  const fail = (code, message) => isNotification ? null : { jsonrpc: '2.0', id, error: { code, message } };
  try {
    switch (method) {
      case 'initialize': {
        const v = MCP_VERSIONS.includes(params.protocolVersion) ? params.protocolVersion : MCP_VERSIONS[0];
        return ok({ protocolVersion: v, capabilities: { tools: { listChanged: false } },
          serverInfo: { name: 'product-spec-configurator', title: 'Product Spec Configurator', version: '1.0.0' },
          instructions: INTERVIEW_GUIDE });
      }
      case 'ping': return ok({});
      case 'tools/list': return ok({ tools: TOOLS });
      case 'tools/call': {
        const r = await callTool(params.name, params.arguments || {}, env, url);
        return ok({ content: [{ type: 'text', text: JSON.stringify(r.data, null, 1) }], structuredContent: r.data, isError: !!r.isError });
      }
      default:
        if (method?.startsWith('notifications/')) return null;
        return fail(-32601, `Method not found: ${method}`);
    }
  } catch (e) {
    console.error(e);
    return isNotification ? null : { jsonrpc: '2.0', id, result: { content: [{ type: 'text', text: 'Error: ' + e.message }], isError: true } };
  }
}

async function familyOptions(env) {
  const { results } = await env.DB.prepare('SELECT id, name FROM product_families WHERE active = 1 ORDER BY sort_order, name').all();
  return [...results.map(r => ({ v: r.id, l: r.name })), { v: 'tbd', l: 'TBD' }];
}
const optionsOf = (f, fams) => f.options === '@families' ? fams : (f.options || []);

function condOk(c, d) {
  const v = d[c.k];
  if ('eq' in c) return v === c.eq;
  if ('in' in c) return c.in.includes(v);
  if ('has' in c) return Array.isArray(v) && v.includes(c.has);
  if ('gt' in c) return Number(v) > c.gt;
  return true;
}
const fieldVisible = (f, d) => !f.showIf || [].concat(f.showIf).every(c => condOk(c, d));

function describeCond(c) {
  if ('eq' in c) return `${c.k} = ${c.eq}`;
  if ('in' in c) return `${c.k} in [${c.in.join(', ')}]`;
  if ('has' in c) return `${c.k} includes ${c.has}`;
  if ('gt' in c) return `${c.k} > ${c.gt}`;
  return '';
}

function checkValue(f, v, fams) {
  const allowed = optionsOf(f, fams).map(o => o.v);
  switch (f.type) {
    case 'text': case 'textarea': case 'date':
      return typeof v === 'string' ? { v: v.slice(0, 5000) } : { err: 'expected a string' };
    case 'number': {
      const n = typeof v === 'string' ? Number(v) : v;
      return typeof n === 'number' && isFinite(n) && n >= 0 ? { v: n } : { err: 'expected a number >= 0' };
    }
    case 'select': case 'feature':
      return allowed.includes(v) ? { v } : { err: `expected one of: ${allowed.join(', ')}` };
    case 'multi': {
      const arr = Array.isArray(v) ? v : [v];
      const bad = arr.filter(x => !allowed.includes(x));
      return bad.length ? { err: `unknown option(s) ${bad.join(', ')}; allowed: ${allowed.join(', ')}` } : { v: [...new Set(arr)] };
    }
    case 'yesno': case 'ynt': {
      const ok = f.type === 'ynt' ? ['yes', 'no', 'tbd'] : ['yes', 'no'];
      return ok.includes(v) ? { v } : { err: `expected one of: ${ok.join(', ')}` };
    }
    case 'features': {
      if (!Array.isArray(v)) return { err: 'expected an array of {name, need, notes}' };
      const rows = v.filter(r => r && typeof r.name === 'string' && r.name.trim()).map(r => ({
        name: r.name.trim().slice(0, 200), need: ['required', 'nice', 'no', 'tbd'].includes(r.need) ? r.need : 'tbd', notes: String(r.notes || '').slice(0, 1000) }));
      return { v: rows };
    }
  }
  return { err: 'unsupported field type' };
}

async function callTool(name, args, env, url) {
  const base = `${url.origin}/`;
  if (name === 'get_spec_form') {
    const fams = await familyOptions(env);
    return { data: { note: 'Profile sections (Profile: …) list each reusable control feature; values std (default) | chg | no. Call get_profile for the standard behaviour text before discussing a profile.',
      sections: SECTIONS.map(s => ({ id: s.id, title: s.title, note: s.desc || undefined, later_phase: s.phase || undefined,
      ask_only_if: s.profile ? `fw.profiles includes ${s.profile}` : undefined,
      features: s.profile ? s.fields.filter(f => f.type === 'feature').map(f => ({ key: f.key, name: f.label, group: f.group })) : undefined,
      values: s.profile ? 'std (default) | chg (then set <key>.notes) | no; free text in prof.' + s.profile + '.other' : undefined,
      questions: s.profile ? undefined : s.fields.map(f => ({ key: f.key, label: f.label, type: f.type, unit: f.unit, hint: f.hint,
        options: f.options ? optionsOf(f, fams).map(o => ({ value: o.v, label: o.l })) : undefined,
        ask_only_if: f.showIf ? [].concat(f.showIf).map(describeCond).join(' AND ') : undefined })) })) } };
  }
  if (name === 'get_profile') {
    const P = PROFILES[args.profile];
    if (!P) return { isError: true, data: { error: `Unknown profile. Available: ${Object.keys(PROFILES).join(', ')}` } };
    return { data: { profile: args.profile, name: P.name, summary: P.summary, typical_io: P.typicalIO, default_ports: P.ports, options: P.options,
      features: P.features.map(e => { const f = profileFeature(e); return { key: `prof.${args.profile}.${f.id}`, name: f.name, group: f.group, standard_behaviour: f.behaviour, tuner_defaults: f.tuners, to_confirm: f.confirm.length ? f.confirm : undefined }; }) } };
  }
  if (name === 'list_specs') {
    const q = `%${String(args.search || '').toLowerCase()}%`;
    const { results } = await env.DB.prepare(
      `SELECT id, title, status, requested_by, updated_at FROM specs WHERE lower(title) LIKE ? OR lower(coalesce(requested_by,'')) LIKE ? ORDER BY updated_at DESC LIMIT 50`).bind(q, q).all();
    return { data: { specs: results.map(r => ({ ...r, link: `${base}#spec/${r.id}` })) } };
  }
  if (name === 'get_spec') {
    const s = await getSpec(env, String(args.id || ''));
    if (!s) return { isError: true, data: { error: 'No requirement with that id. Use list_specs.' } };
    return { data: { id: s.id, title: s.title, status: s.status, updated_at: s.updated_at, answers: s.data, link: `${base}#spec/${s.id}` } };
  }
  if (name === 'save_spec') {
    const answers = args.answers && typeof args.answers === 'object' && !Array.isArray(args.answers) ? args.answers : null;
    if (!answers) return { isError: true, data: { error: 'answers must be an object of field key -> value' } };
    let existing = null, data = {};
    if (args.id) {
      existing = await env.DB.prepare('SELECT id, data, status FROM specs WHERE id = ?').bind(String(args.id)).first();
      if (!existing) return { isError: true, data: { error: 'No requirement with that id. Omit id to create a new one.' } };
      if (args.merge !== false) data = JSON.parse(existing.data);
    }
    const fams = await familyOptions(env);
    const rejected = [];
    for (const [k, v] of Object.entries(answers)) {
      const f = FIELDS[k];
      if (!f) { rejected.push({ key: k, reason: 'unknown field key (see get_spec_form)' }); continue; }
      if (v === null || v === '' || (Array.isArray(v) && !v.length)) { delete data[k]; continue; }
      const r = checkValue(f, v, fams);
      if (r.err) rejected.push({ key: k, value: v, reason: r.err }); else data[k] = r.v;
    }
    // drop answers to questions that no longer apply (same rule as the page)
    const dropped = [];
    for (const k of Object.keys(data)) if (!FIELDS[k] || !fieldVisible(FIELDS[k], data)) { dropped.push(k); delete data[k]; }
    if (!data['overview.title']) return { isError: true, data: { error: 'overview.title is required before the first save', rejected } };
    const status = STATUSES.includes(args.status) ? args.status : (existing?.status || 'draft');
    const s = await saveSpec(env, existing?.id || null, data, status, existing);
    const unanswered = SECTIONS.flatMap(sec => sec.fields.filter(f => fieldVisible(f, data) && !(f.key in data)).map(f => f.key));
    return { data: { id: s.id, title: s.title, status: s.status, saved_answers: Object.keys(data).length,
      rejected: rejected.length ? rejected : undefined, removed_no_longer_applicable: dropped.length ? dropped : undefined,
      unanswered, link: `${base}#spec/${s.id}` } };
  }
  return { isError: true, data: { error: `Unknown tool ${name}` } };
}

// ---------------- helpers ----------------
// Runs schema.sql (all IF NOT EXISTS / INSERT OR IGNORE) once per Worker instance.
async function ensureSchema(env) {
  const stmts = SCHEMA.split('\n').filter(l => !l.trim().startsWith('--')).join('\n')
    .split(';').map(x => x.trim()).filter(Boolean);
  await env.DB.batch(stmts.map(sql => env.DB.prepare(sql)));
}

const STATUSES = ['draft', 'submitted', 'in_review', 'approved', 'archived'];

async function readSpecBody(req) {
  const body = await req.json().catch(() => null);
  if (!body || typeof body.data !== 'object' || Array.isArray(body.data)) return { error: 'Body must be { data: {...}, status }' };
  const title = String(body.data['overview.title'] || '').trim();
  if (!title) return { error: 'overview.title is required' };
  const raw = JSON.stringify(body.data);
  if (raw.length > 200_000) return { error: 'Spec is too large' };
  return { data: body.data, status: STATUSES.includes(body.status) ? body.status : 'draft' };
}

function specColumns({ data, status }) {
  const fam = data['mech.reuse'] === 'yes' ? data['mech.family'] : data['overview.base_family'];
  return {
    title: String(data['overview.title']).slice(0, 200),
    product_type: data['overview.product_type'] || null,
    product_family: fam || null,
    status,
    requested_by: data['overview.requested_by'] ? String(data['overview.requested_by']).slice(0, 200) : null,
    data: JSON.stringify(data),
  };
}

// One row per answer (one per option for multi-selects). Phase 2 matching and
// Phase 3 BOQ costing read from spec_values instead of parsing JSON.
function flattenStatements(env, specId, data) {
  const rows = [];
  for (const [key, v] of Object.entries(data)) {
    const section = key.split('.')[0];
    if (Array.isArray(v)) {
      for (const item of v) {
        if (item && typeof item === 'object') {           // feature list rows
          const name = String(item.name || '').trim();
          if (!name) continue;
          rows.push([section, key, name.toLowerCase(), null]);
          rows.push([section, `${key}.${slug(name)}`, String(item.need || ''), null]);
        } else {
          rows.push([section, key, String(item), null]);
        }
      }
    } else if (typeof v === 'number') {
      rows.push([section, key, String(v), v]);
    } else if (v !== null && v !== undefined && v !== '') {
      rows.push([section, key, String(v).slice(0, 2000), null]);
    }
  }
  return rows.map(r => env.DB.prepare('INSERT INTO spec_values (spec_id, section, key, value, num_value) VALUES (?,?,?,?,?)').bind(specId, ...r));
}

async function getSpec(env, id) {
  const s = await env.DB.prepare('SELECT * FROM specs WHERE id = ?').bind(id).first();
  return s ? { ...s, data: JSON.parse(s.data) } : null;
}

const slug = s => s.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 60);

function newId() {
  const t = Date.now().toString(36);
  const r = crypto.getRandomValues(new Uint8Array(6));
  return `spec-${t}-${[...r].map(b => b.toString(16).padStart(2, '0')).join('')}`;
}

function json(obj, status = 200, headers = {}) {
  return new Response(JSON.stringify(obj), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store', ...headers } });
}

function securityHeaders() {
  return { 'x-frame-options': 'DENY', 'referrer-policy': 'same-origin', 'x-content-type-options': 'nosniff' };
}

function cookie(value, maxAge, url) {
  const secure = url.protocol === 'https:' ? '; Secure' : '';
  return `${COOKIE}=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure}`;
}

async function hmacKey(env) {
  // Changing the password (or SESSION_SECRET) signs everyone out.
  const secret = `${env.SESSION_SECRET || ''}::${env.ACCESS_PASSWORD}`;
  return crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
}
async function sign(msg, env) {
  const sig = await crypto.subtle.sign('HMAC', await hmacKey(env), enc.encode(msg));
  return btoa(String.fromCharCode(...new Uint8Array(sig))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
async function safeEqual(a, b, env) {
  // compare HMACs so timing does not leak the password
  const [x, y] = await Promise.all([sign('pw:' + a, env), sign('pw:' + b, env)]);
  let diff = x.length ^ y.length;
  for (let i = 0; i < Math.min(x.length, y.length); i++) diff |= x.charCodeAt(i) ^ y.charCodeAt(i);
  return diff === 0;
}
async function authed(req, env) {
  const c = req.headers.get('cookie') || '';
  const m = c.match(new RegExp(`(?:^|;\\s*)${COOKIE}=([^;]+)`));
  if (!m) return false;
  const [exp, sig] = m[1].split('.');
  if (!exp || !sig || Number(exp) < Date.now()) return false;
  return safeEqual(sig, await sign(exp, env), env);
}
