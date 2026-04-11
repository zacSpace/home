// ================================================================
//  NYC SUBWAY TRANSIT PLANNER — app.js
//  Fill in the two API key constants below, then open index.html.
// ================================================================

// ─── API KEYS ────────────────────────────────────────────────────────────────
// Google Maps: https://console.cloud.google.com/
//   Enable: Directions API, Places API, Geocoding API
//   Restrict the key to your domain for production use.
const GOOGLE_MAPS_API_KEY = 'AIzaSyD8VKrDa-BbfqKT5BhouxHWH5ISKhYSsvM';

// MTA GTFS-RT feeds are open — no API key required.

// ─── MTA GTFS-RT FEED URLS ───────────────────────────────────────────────────
const MTA_FEED_URLS = {
  'gtfs':      'https://api-endpoint.mta.info/Dataservice/mtagtfsfeeds/nyct%2Fgtfs',
  'gtfs-ace':  'https://api-endpoint.mta.info/Dataservice/mtagtfsfeeds/nyct%2Fgtfs-ace',
  'gtfs-nqrw': 'https://api-endpoint.mta.info/Dataservice/mtagtfsfeeds/nyct%2Fgtfs-nqrw',
  'gtfs-bdfm': 'https://api-endpoint.mta.info/Dataservice/mtagtfsfeeds/nyct%2Fgtfs-bdfm',
  'gtfs-l':    'https://api-endpoint.mta.info/Dataservice/mtagtfsfeeds/nyct%2Fgtfs-l',
  'gtfs-g':    'https://api-endpoint.mta.info/Dataservice/mtagtfsfeeds/nyct%2Fgtfs-g',
  'gtfs-jz':   'https://api-endpoint.mta.info/Dataservice/mtagtfsfeeds/nyct%2Fgtfs-jz',
  'gtfs-7':    'https://api-endpoint.mta.info/Dataservice/mtagtfsfeeds/nyct%2Fgtfs-7',
  'gtfs-si':   'https://api-endpoint.mta.info/Dataservice/mtagtfsfeeds/nyct%2Fgtfs-si',
};

// Returns the GTFS-RT feed key for a given subway line letter/number.
function getFeedKey(line) {
  const l = (line || '').toUpperCase().trim();
  if (['1','2','3','4','5','6'].includes(l)) return 'gtfs';
  if (l === '7')                              return 'gtfs-7';
  if (['A','C','E'].includes(l))             return 'gtfs-ace';
  if (['N','Q','R','W'].includes(l))         return 'gtfs-nqrw';
  if (['B','D','F','M'].includes(l))         return 'gtfs-bdfm';
  if (l === 'L')                             return 'gtfs-l';
  if (l === 'G')                             return 'gtfs-g';
  if (['J','Z'].includes(l))                 return 'gtfs-jz';
  if (l === 'S')                             return 'gtfs-si';
  return 'gtfs';
}

// ─── SUBWAY LINE DISPLAY COLOURS ─────────────────────────────────────────────
// Known MTA subway line identifiers (single letter/number).
const KNOWN_LINES = new Set([
  '1','2','3','4','5','6','7',
  'A','C','E','B','D','F','M','G','J','Z','L','N','Q','R','W','S',
  'SIR','SI',
]);

// Normalise whatever string the Maps API returns into a known MTA line ID.
// The API sometimes returns things like "Inf" (subway vehicle type) or the
// full route name. We try to extract a single letter/number from it.
function normalizeLineName(raw) {
  if (!raw) return '?';
  const s = raw.trim().toUpperCase();
  // Already a known line
  if (KNOWN_LINES.has(s)) return s;
  // Try to pull out a known line embedded in a longer string (e.g. "A train")
  for (const known of KNOWN_LINES) {
    const re = new RegExp(`(^|[^A-Z0-9])${known}($|[^A-Z0-9])`, 'i');
    if (re.test(s)) return known;
  }
  // Fallback: first 1-2 meaningful chars
  const letters = s.replace(/[^A-Z0-9]/g, '');
  return letters.slice(0, 2) || '?';
}

const LINE_COLORS = {
  '1':'#EE352E','2':'#EE352E','3':'#EE352E',
  '4':'#00933C','5':'#00933C','6':'#00933C',
  '7':'#B933AD',
  'A':'#0039A6','C':'#0039A6','E':'#0039A6',
  'B':'#FF6319','D':'#FF6319','F':'#FF6319','M':'#FF6319',
  'G':'#6CBE45',
  'J':'#996633','Z':'#996633',
  'L':'#A7A9AC',
  'N':'#FCCC0A','Q':'#FCCC0A','R':'#FCCC0A','W':'#FCCC0A',
  'S':'#808183',
};
// Lines whose bullet needs dark text (light background)
const LIGHT_BG_LINES = new Set(['N','Q','R','W','L','G']);

// ─── STATION → STOP-ID DATABASE ──────────────────────────────────────────────
// Each entry maps one or more normalised station name aliases to the MTA GTFS
// stop ID (without N/S direction suffix) for each relevant feed.
//
// To extend this list look up stop_id values in the MTA GTFS static feed's
// stops.txt: https://api.mta.info/#/subwayRealTimeFeeds → "GTFS Static"
//
// Only base IDs are stored here; the N/S suffix is determined at query time by
// trying both and returning the soonest upcoming departure.
const STATIONS = [
  // ── Major transfer hubs ──────────────────────────────────────────────────
  {
    names: ['times sq-42 st','times square-42 st','42 st-times sq','times square','42nd st-times sq'],
    stops: { 'gtfs':'127', 'gtfs-7':'725', 'gtfs-nqrw':'R16', 'gtfs-ace':'A22' }
  },
  {
    names: ['grand central-42 st','42 st-grand central','grand central','grand central terminal'],
    stops: { 'gtfs':'631', 'gtfs-7':'723' }
  },
  {
    names: ['34 st-penn station','34th st-penn station','penn station','34 st penn station'],
    stops: { 'gtfs':'128', 'gtfs-ace':'A28' }
  },
  {
    names: ['34 st-herald sq','herald sq','herald square','34 st herald sq'],
    stops: { 'gtfs-nqrw':'R17', 'gtfs-bdfm':'D17' }
  },
  {
    names: ['14 st-union sq','union sq','union square','14 st-union square','14 st union sq'],
    stops: { 'gtfs':'635', 'gtfs-nqrw':'R20', 'gtfs-l':'L03' }
  },
  {
    names: ['59 st-columbus circle','59 st columbus circle','columbus circle'],
    stops: { 'gtfs':'125', 'gtfs-ace':'A20' }
  },
  {
    names: ['59 st','lexington av/59 st','59 st lexington av','59 st/lexington av'],
    stops: { 'gtfs':'629' }
  },
  {
    names: ['atlantic av-barclays ctr','atlantic av','barclays ctr','atlantic avenue-barclays center','atlantic av barclays ctr'],
    stops: { 'gtfs':'235', 'gtfs-nqrw':'R31', 'gtfs-bdfm':'D24', 'gtfs-l':'L19' }
  },
  {
    names: ['fulton st','fulton street'],
    stops: { 'gtfs':'640', 'gtfs-ace':'A38', 'gtfs-nqrw':'R25', 'gtfs-jz':'J27' }
  },
  {
    names: ['jay st-metrotech','jay st metrotech','jay street metrotech'],
    stops: { 'gtfs-ace':'A41', 'gtfs-nqrw':'R29' }
  },
  {
    names: ['42 st-bryant park','bryant park'],
    stops: { 'gtfs-bdfm':'D15' }
  },
  {
    names: ['47-50 sts-rockefeller ctr','rockefeller ctr','rockefeller center','47-50 sts rockefeller ctr'],
    stops: { 'gtfs-bdfm':'D16' }
  },
  {
    names: ['49 st'],
    stops: { 'gtfs-nqrw':'R13' }
  },
  {
    names: ['west 4 st-washington sq','west 4 st','w 4 st-wash sq','washington sq'],
    stops: { 'gtfs-ace':'A32', 'gtfs-bdfm':'D20' }
  },
  {
    names: ['borough hall','borough hall (r)'],
    stops: { 'gtfs':'644', 'gtfs-nqrw':'R30' }
  },
  {
    names: ['court st'],
    stops: { 'gtfs-nqrw':'R30' }
  },
  {
    names: ['broadway junction','broadway junction (j/z)','broadway junction (l)'],
    stops: { 'gtfs-jz':'J24', 'gtfs-l':'L18', 'gtfs-ace':'L18' }
  },
  {
    names: ['delancey st-essex st','delancey st','essex st'],
    stops: { 'gtfs-jz':'J20', 'gtfs-bdfm':'F15' }
  },
  {
    names: ['queensboro plaza','queensboro plz'],
    stops: { 'gtfs-nqrw':'R09', 'gtfs-7':'718' }
  },
  {
    names: ['court sq','court sq-23 st'],
    stops: { 'gtfs-g':'G22', 'gtfs-7':'719' }
  },

  // ── 1/2/3 line ───────────────────────────────────────────────────────────
  { names:['van cortlandt park-242 st','242 st','van cortlandt park'], stops:{'gtfs':'101'} },
  { names:['238 st'],                     stops:{'gtfs':'103'} },
  { names:['231 st'],                     stops:{'gtfs':'104'} },
  { names:['marble hill-225 st','225 st'],stops:{'gtfs':'106'} },
  { names:['215 st'],                     stops:{'gtfs':'107'} },
  { names:['207 st'],                     stops:{'gtfs':'108'} },
  { names:['dyckman st'],                 stops:{'gtfs':'109'} },
  { names:['191 st'],                     stops:{'gtfs':'110'} },
  { names:['181 st'],                     stops:{'gtfs':'111'} },
  { names:['168 st-washington hts','168 st','washington heights'], stops:{'gtfs':'112'} },
  { names:['157 st'],                     stops:{'gtfs':'113'} },
  { names:['145 st'],                     stops:{'gtfs':'114'} },
  { names:['137 st-city college','137 st'],stops:{'gtfs':'115'} },
  { names:['125 st'],                     stops:{'gtfs':'116','gtfs-ace':'A11'} },
  { names:['116 st-columbia university','116 st columbia'], stops:{'gtfs':'117'} },
  { names:['cathedral pkwy (110 st)','cathedral pkwy','110 st','cathedral parkway'], stops:{'gtfs':'118'} },
  { names:['103 st'],                     stops:{'gtfs':'119'} },
  { names:['96 st'],                      stops:{'gtfs':'120'} },
  { names:['86 st'],                      stops:{'gtfs':'121'} },
  { names:['79 st'],                      stops:{'gtfs':'122'} },
  { names:['72 st'],                      stops:{'gtfs':'123','gtfs-ace':'A19'} },
  { names:['66 st-lincoln center','66 st lincoln center','66 st'], stops:{'gtfs':'124'} },
  { names:['50 st'],                      stops:{'gtfs':'126','gtfs-ace':'A21'} },
  { names:['28 st'],                      stops:{'gtfs':'129','gtfs-nqrw':'R18'} },
  { names:['23 st'],                      stops:{'gtfs':'130','gtfs-nqrw':'R19'} },
  { names:['18 st'],                      stops:{'gtfs':'131'} },
  { names:['14 st'],                      stops:{'gtfs':'132','gtfs-ace':'A30'} },
  { names:['christopher st-sheridan sq','christopher st'], stops:{'gtfs':'133'} },
  { names:['houston st'],                 stops:{'gtfs':'134'} },
  { names:['canal st'],                   stops:{'gtfs':'135','gtfs-nqrw':'R23','gtfs-ace':'A34'} },
  { names:['franklin st'],                stops:{'gtfs':'136'} },
  { names:['chambers st'],               stops:{'gtfs':'137','gtfs-ace':'A36'} },
  { names:['wtc cortlandt','cortlandt st','world trade center'], stops:{'gtfs':'138'} },
  { names:['rector st'],                  stops:{'gtfs':'139','gtfs-nqrw':'R26'} },
  { names:['south ferry','whitehall st-south ferry','whitehall st'], stops:{'gtfs':'140','gtfs-nqrw':'R27'} },

  // 2/3 Bronx
  { names:['wakefield-241 st','241 st'],  stops:{'gtfs':'201'} },
  { names:['nereid av'],                  stops:{'gtfs':'204'} },
  { names:['233 st'],                     stops:{'gtfs':'205'} },
  { names:['219 st'],                     stops:{'gtfs':'207'} },
  { names:['gun hill rd'],                stops:{'gtfs':'208'} },
  { names:['burke av'],                   stops:{'gtfs':'209'} },
  { names:['allerton av'],                stops:{'gtfs':'210'} },
  { names:['pelham pkwy'],                stops:{'gtfs':'211'} },
  { names:['bronx park east'],            stops:{'gtfs':'212'} },
  { names:['e 180 st'],                   stops:{'gtfs':'213'} },
  { names:['west farms sq-e tremont av'], stops:{'gtfs':'214'} },
  { names:['174 st'],                     stops:{'gtfs':'215'} },
  { names:['freeman st'],                 stops:{'gtfs':'216'} },
  { names:['simpson st'],                 stops:{'gtfs':'217'} },
  { names:['intervale av'],               stops:{'gtfs':'218'} },
  { names:['prospect av'],                stops:{'gtfs':'219'} },
  { names:['jackson av'],                 stops:{'gtfs':'220'} },
  { names:['3 av-149 st'],               stops:{'gtfs':'221'} },
  { names:['149 st-grand concourse','grand concourse'], stops:{'gtfs':'222'} },
  { names:['135 st (2/3)'],              stops:{'gtfs':'223'} },

  // ── 4/5/6 line ───────────────────────────────────────────────────────────
  { names:['pelham bay park'],            stops:{'gtfs':'601'} },
  { names:['buhre av'],                   stops:{'gtfs':'602'} },
  { names:['middletown rd'],              stops:{'gtfs':'603'} },
  { names:['westchester sq-e tremont av'],stops:{'gtfs':'604'} },
  { names:['zerega av'],                  stops:{'gtfs':'605'} },
  { names:['castle hill av'],             stops:{'gtfs':'606'} },
  { names:['parkchester'],                stops:{'gtfs':'607'} },
  { names:['st lawrence av'],             stops:{'gtfs':'608'} },
  { names:['morrison av-soundview'],      stops:{'gtfs':'609'} },
  { names:['elder av'],                   stops:{'gtfs':'610'} },
  { names:['whitlock av'],                stops:{'gtfs':'611'} },
  { names:['hunts point av'],             stops:{'gtfs':'612'} },
  { names:['longwood av'],                stops:{'gtfs':'613'} },
  { names:['e 149 st'],                   stops:{'gtfs':'614'} },
  { names:['cypress av'],                 stops:{'gtfs':'616'} },
  { names:['e 138 st-grand concourse'],   stops:{'gtfs':'617'} },
  { names:['brook av'],                   stops:{'gtfs':'618'} },
  { names:['3 av-138 st'],               stops:{'gtfs':'619'} },
  { names:['125 st (lex)'],              stops:{'gtfs':'621'} },
  { names:['116 st (lex)'],              stops:{'gtfs':'622'} },
  { names:['110 st (lex)'],              stops:{'gtfs':'623'} },
  { names:['103 st (lex)'],              stops:{'gtfs':'624'} },
  { names:['96 st (lex)'],               stops:{'gtfs':'625'} },
  { names:['86 st (lex)'],               stops:{'gtfs':'626'} },
  { names:['77 st'],                      stops:{'gtfs':'627'} },
  { names:['68 st-hunter college','68 st hunter college'], stops:{'gtfs':'628'} },
  { names:['51 st'],                      stops:{'gtfs':'630'} },
  { names:['33 st'],                      stops:{'gtfs':'632'} },
  { names:['28 st (lex)'],               stops:{'gtfs':'633'} },
  { names:['23 st (lex)'],               stops:{'gtfs':'634'} },
  { names:['astor pl'],                   stops:{'gtfs':'636'} },
  { names:['bleecker st'],                stops:{'gtfs':'637'} },
  { names:['spring st'],                  stops:{'gtfs':'638'} },
  { names:['canal st (4/5/6)'],          stops:{'gtfs':'639'} },
  { names:['brooklyn bridge-city hall','brooklyn bridge'], stops:{'gtfs':'640'} },
  { names:['wall st'],                    stops:{'gtfs':'642'} },
  { names:['bowling green'],              stops:{'gtfs':'643'} },

  // ── A/C/E line ───────────────────────────────────────────────────────────
  { names:['inwood-207 st','inwood 207 st'], stops:{'gtfs-ace':'A02'} },
  { names:['190 st'],                     stops:{'gtfs-ace':'A04'} },
  { names:['181 st (a)'],                 stops:{'gtfs-ace':'A05'} },
  { names:['175 st'],                     stops:{'gtfs-ace':'A06'} },
  { names:['168 st (a/c)'],              stops:{'gtfs-ace':'A07'} },
  { names:['163 st-amsterdam av'],        stops:{'gtfs-ace':'A08'} },
  { names:['145 st (a/b/c/d)'],          stops:{'gtfs-ace':'A09'} },
  { names:['135 st (b/c)'],              stops:{'gtfs-ace':'A10'} },
  { names:['116 st (b/c)'],              stops:{'gtfs-ace':'A12'} },
  { names:['110 st (b/c)'],              stops:{'gtfs-ace':'A14'} },
  { names:['103 st (b/c)'],              stops:{'gtfs-ace':'A15'} },
  { names:['96 st (b/c)'],               stops:{'gtfs-ace':'A16'} },
  { names:['86 st (b/c)'],               stops:{'gtfs-ace':'A17'} },
  { names:['81 st-museum of natural history','81 st museum'], stops:{'gtfs-ace':'A18'} },
  { names:['72 st (b/c)'],               stops:{'gtfs-ace':'A19'} },
  { names:['23 st (c/e)'],               stops:{'gtfs-ace':'A29'} },
  { names:['howard beach-jfk airport','howard beach'], stops:{'gtfs-ace':'H01'} },
  { names:['broad channel'],              stops:{'gtfs-ace':'H06'} },
  { names:['ozone park-lefferts blvd','lefferts blvd'], stops:{'gtfs-ace':'H11'} },

  // ── N/Q/R/W line ─────────────────────────────────────────────────────────
  { names:['57 st-7 av','57 st 7th av'], stops:{'gtfs-nqrw':'R11'} },
  { names:['5 av/59 st','5 av 59 st','59 st 5th av'], stops:{'gtfs-nqrw':'R10'} },
  { names:['8 st-nyu','8 st'],           stops:{'gtfs-nqrw':'R21'} },
  { names:['prince st'],                  stops:{'gtfs-nqrw':'R22'} },
  { names:['city hall (r)'],             stops:{'gtfs-nqrw':'R27'} },
  { names:['cortlandt st'],              stops:{'gtfs-nqrw':'R25'} },
  { names:['union st'],                  stops:{'gtfs-nqrw':'R32'} },
  { names:['4 av-9 st'],                 stops:{'gtfs-nqrw':'R33'} },
  { names:['prospect av (r)'],           stops:{'gtfs-nqrw':'R34'} },
  { names:['25 st'],                      stops:{'gtfs-nqrw':'R35'} },
  { names:['36 st'],                      stops:{'gtfs-nqrw':'R36'} },
  { names:['45 st'],                      stops:{'gtfs-nqrw':'R37'} },
  { names:['53 st'],                      stops:{'gtfs-nqrw':'R38'} },
  { names:['59 st (r/brooklyn)'],        stops:{'gtfs-nqrw':'R39'} },
  { names:['bay ridge av'],              stops:{'gtfs-nqrw':'R40'} },
  { names:['77 st (r)'],                 stops:{'gtfs-nqrw':'R41'} },
  { names:['86 st (r)'],                 stops:{'gtfs-nqrw':'R42'} },
  { names:['95 st'],                      stops:{'gtfs-nqrw':'R43'} },
  { names:['ditmars blvd','astoria-ditmars blvd'], stops:{'gtfs-nqrw':'R01'} },
  { names:['astoria blvd'],              stops:{'gtfs-nqrw':'R03'} },
  { names:['30 av'],                      stops:{'gtfs-nqrw':'R04'} },
  { names:['broadway (astoria)'],        stops:{'gtfs-nqrw':'R05'} },
  { names:['36 av'],                      stops:{'gtfs-nqrw':'R06'} },
  { names:['39 av-dutch kills'],         stops:{'gtfs-nqrw':'R07'} },

  // ── B/D/F/M line ─────────────────────────────────────────────────────────
  { names:['57 st (f)','57 st 6th av'],  stops:{'gtfs-bdfm':'D21'} },
  { names:['23 st (f/m)'],               stops:{'gtfs-bdfm':'D22'} },
  { names:['14 st (f/m)'],               stops:{'gtfs-bdfm':'D23'} },
  { names:['church av'],                  stops:{'gtfs-bdfm':'D26','gtfs-g':'F36'} },
  { names:['bergen st'],                  stops:{'gtfs-bdfm':'F25','gtfs-g':'F25'} },
  { names:['carroll st'],                 stops:{'gtfs-bdfm':'F26'} },
  { names:['smith-9 sts'],               stops:{'gtfs-bdfm':'F27'} },
  { names:['metropolitan av'],           stops:{'gtfs-g':'G29','gtfs-bdfm':'M18'} },
  { names:['dekalb av'],                  stops:{'gtfs-bdfm':'D43'} },
  { names:['atlantic av-pacific st'],    stops:{'gtfs-bdfm':'D24'} },

  // ── L line ───────────────────────────────────────────────────────────────
  { names:['8 av'],                       stops:{'gtfs-l':'L01'} },
  { names:['6 av (l)','6th av l'],        stops:{'gtfs-l':'L02'} },
  { names:['3 av (l)'],                   stops:{'gtfs-l':'L04'} },
  { names:['1 av'],                       stops:{'gtfs-l':'L05'} },
  { names:['bedford av','bedford ave'],   stops:{'gtfs-l':'L06'} },
  { names:['lorimer st'],                 stops:{'gtfs-l':'L07'} },
  { names:['graham av'],                  stops:{'gtfs-l':'L08'} },
  { names:['grand st (l)'],              stops:{'gtfs-l':'L09'} },
  { names:['montrose av'],               stops:{'gtfs-l':'L10'} },
  { names:['morgan av'],                  stops:{'gtfs-l':'L11'} },
  { names:['jefferson st'],              stops:{'gtfs-l':'L12'} },
  { names:['dekalb av (l)'],             stops:{'gtfs-l':'L13'} },
  { names:['myrtle-wyckoff avs'],        stops:{'gtfs-l':'L14'} },
  { names:['halsey st'],                  stops:{'gtfs-l':'L15'} },
  { names:['wilson av'],                  stops:{'gtfs-l':'L16'} },
  { names:['bushwick av-aberdeen st'],   stops:{'gtfs-l':'L17'} },
  { names:['sutter av (l)'],             stops:{'gtfs-l':'L20'} },
  { names:['livonia av'],                 stops:{'gtfs-l':'L21'} },
  { names:['new lots av'],               stops:{'gtfs-l':'L22'} },
  { names:['canarsie-rockaway pkwy','canarsie'], stops:{'gtfs-l':'L24'} },

  // ── G line ───────────────────────────────────────────────────────────────
  { names:['21 st-queensbridge','queensbridge'], stops:{'gtfs-g':'G24'} },
  { names:['greenpoint av'],              stops:{'gtfs-g':'G26'} },
  { names:['nassau av'],                  stops:{'gtfs-g':'G28'} },
  { names:['broadway (g)'],              stops:{'gtfs-g':'G30'} },
  { names:['flushing av'],               stops:{'gtfs-g':'G31'} },
  { names:['myrtle-willoughby avs'],     stops:{'gtfs-g':'G32'} },
  { names:['bedford-nostrand avs'],      stops:{'gtfs-g':'G33'} },
  { names:['classon av'],                 stops:{'gtfs-g':'G34'} },
  { names:['clinton-washington avs'],    stops:{'gtfs-g':'G35'} },
  { names:['fulton st (g)'],             stops:{'gtfs-g':'G36'} },
  { names:['ditmas av'],                  stops:{'gtfs-g':'F35'} },
  { names:['fort hamilton pkwy'],        stops:{'gtfs-g':'F34'} },
  { names:['9 av'],                       stops:{'gtfs-g':'F33'} },

  // ── J/Z line ─────────────────────────────────────────────────────────────
  { names:['broad st'],                   stops:{'gtfs-jz':'J12'} },
  { names:['fulton st (j/z)'],           stops:{'gtfs-jz':'J14'} },
  { names:['chambers st (j/z)'],         stops:{'gtfs-jz':'J15'} },
  { names:['canal st (j/z)'],            stops:{'gtfs-jz':'J16'} },
  { names:['bowery'],                     stops:{'gtfs-jz':'J17'} },
  { names:['marcy av'],                   stops:{'gtfs-jz':'J21'} },
  { names:['hewes st'],                   stops:{'gtfs-jz':'J22'} },
  { names:['lorimer st (j/m)'],          stops:{'gtfs-jz':'J23'} },
  { names:['alabama av'],                 stops:{'gtfs-jz':'J25'} },
  { names:['van siclen av (j/z)'],       stops:{'gtfs-jz':'J26'} },
  { names:['crescent st'],               stops:{'gtfs-jz':'J27'} },
  { names:['norwood av'],                 stops:{'gtfs-jz':'J28'} },
  { names:['cleveland st'],              stops:{'gtfs-jz':'J29'} },
  { names:['woodhaven blvd (j/z)'],      stops:{'gtfs-jz':'J30'} },
  { names:['75 st-elderts ln'],          stops:{'gtfs-jz':'J31'} },

  // ── 7 line ───────────────────────────────────────────────────────────────
  { names:['flushing-main st','main st-flushing','main st flushing'], stops:{'gtfs-7':'701'} },
  { names:['mets-willets pt','willets point','willets pt'], stops:{'gtfs-7':'702'} },
  { names:['junction blvd'],             stops:{'gtfs-7':'706'} },
  { names:['90 st-elmhurst av'],         stops:{'gtfs-7':'707'} },
  { names:['82 st-jackson hts'],         stops:{'gtfs-7':'708'} },
  { names:['74 st-broadway','jackson hts-roosevelt av'], stops:{'gtfs-7':'709'} },
  { names:['61 st-woodside'],            stops:{'gtfs-7':'711'} },
  { names:['52 st'],                      stops:{'gtfs-7':'712'} },
  { names:['46 st-bliss st'],            stops:{'gtfs-7':'713'} },
  { names:['40 st-lowery st'],           stops:{'gtfs-7':'714'} },
  { names:['33 st-rawson st'],           stops:{'gtfs-7':'715'} },
  { names:['hunters point av'],          stops:{'gtfs-7':'720'} },
  { names:['34 st-hudson yards','hudson yards'], stops:{'gtfs-7':'726'} },
];

// ─── GTFS-RT PROTOBUF SCHEMA ─────────────────────────────────────────────────
// Minimal schema covering only the fields we need from GTFS-Realtime.
const GTFS_RT_PROTO = `
  syntax = "proto2";
  package transit_realtime;

  message FeedMessage {
    required FeedHeader header = 1;
    repeated FeedEntity entity = 2;
  }
  message FeedHeader {
    required string gtfs_realtime_version = 1;
    optional uint64 timestamp = 3;
  }
  message FeedEntity {
    required string id = 1;
    optional bool is_deleted = 2;
    optional TripUpdate trip_update = 3;
  }
  message TripUpdate {
    required TripDescriptor trip = 1;
    repeated StopTimeUpdate stop_time_update = 2;
  }
  message TripDescriptor {
    optional string trip_id = 1;
    optional string route_id = 5;
  }
  message StopTimeUpdate {
    optional uint32 stop_sequence = 1;
    optional StopTimeEvent arrival = 2;
    optional StopTimeEvent departure = 3;
    optional string stop_id = 4;
  }
  message StopTimeEvent {
    optional int32 delay = 1;
    optional int64 time = 2;
  }
`;

let FeedMessage; // initialised once protobuf.js is ready
let directionsService;
let placesAutocomplete;
let userCoords  = null; // { lat, lng }
let bufferMin   = 3;   // platform buffer in minutes (user-adjustable)

// ─── SAVED TRIPS (localStorage) ──────────────────────────────────────────────
const TRIPS_KEY = 'nycTransitSavedTrips';

function loadTrips() {
  try { return JSON.parse(localStorage.getItem(TRIPS_KEY)) || []; }
  catch { return []; }
}

function saveTrips(trips) {
  localStorage.setItem(TRIPS_KEY, JSON.stringify(trips));
}

function renderSavedTrips() {
  const trips = loadTrips();
  const row   = document.getElementById('savedTripsRow');
  row.innerHTML = '';

  if (trips.length === 0) {
    row.classList.add('hidden');
    return;
  }
  row.classList.remove('hidden');

  for (let i = 0; i < trips.length; i++) {
    const trip = trips[i];
    const chip = document.createElement('div');
    chip.className = 'trip-chip';
    chip.innerHTML = `
      <span class="chip-name">${escHtml(trip.name)}</span>
      ${trip.arriveBy ? `<span class="chip-time">${formatHHMM(trip.arriveBy)}</span>` : ''}
      <button class="chip-delete" data-idx="${i}" aria-label="Delete trip">&times;</button>`;

    chip.querySelector('.chip-delete').addEventListener('click', e => {
      e.stopPropagation();
      const trips2 = loadTrips();
      trips2.splice(Number(e.target.dataset.idx), 1);
      saveTrips(trips2);
      renderSavedTrips();
    });

    chip.addEventListener('click', e => {
      if (e.target.classList.contains('chip-delete')) return;
      applyTrip(trip);
    });

    row.appendChild(chip);
  }
}

function applyTrip(trip) {
  document.getElementById('origin').value      = trip.origin;
  document.getElementById('destination').value = trip.destination;
  userCoords = null; // text address, not coords

  // Set buffer from trip
  bufferMin = trip.bufferMin ?? 3;
  updateBufferDisplay();

  if (trip.arriveBy) {
    document.getElementById('arrivalTime').value = trip.arriveBy;
    if (trip.lockTime) {
      // Auto-submit
      document.getElementById('plannerForm').requestSubmit();
    }
  }
}

function formatHHMM(hhmm) {
  const [h, m] = hhmm.split(':').map(Number);
  const ap = h >= 12 ? 'PM' : 'AM';
  return `${h % 12 || 12}:${String(m).padStart(2,'0')} ${ap}`;
}

function openSaveModal() {
  const origin = document.getElementById('origin').value.trim();
  const dest   = document.getElementById('destination').value.trim();
  if (!origin || !dest) { showError('Enter an origin and destination before saving.'); return; }
  document.getElementById('tripName').value     = '';
  document.getElementById('saveLockTime').checked = false;
  document.getElementById('saveTripModal').classList.remove('hidden');
  document.getElementById('tripName').focus();
}

function closeSaveModal() {
  document.getElementById('saveTripModal').classList.add('hidden');
}

function confirmSaveTrip() {
  const name   = document.getElementById('tripName').value.trim();
  if (!name) { document.getElementById('tripName').focus(); return; }

  const origin   = document.getElementById('origin').value.trim();
  const dest     = document.getElementById('destination').value.trim();
  const timeVal  = document.getElementById('arrivalTime').value;
  const lockTime = document.getElementById('saveLockTime').checked;

  const trip = {
    name,
    origin,
    destination: dest,
    arriveBy:  lockTime && timeVal ? timeVal : null,
    lockTime:  lockTime && !!timeVal,
    bufferMin,
  };

  const trips = loadTrips();
  trips.push(trip);
  saveTrips(trips);
  renderSavedTrips();
  closeSaveModal();
}

function updateBufferDisplay() {
  document.getElementById('bufferDisplay').textContent = `${bufferMin} min`;
}

// ─── STATION LOOKUP ──────────────────────────────────────────────────────────
function normalise(name) {
  return (name || '').toLowerCase().replace(/[^a-z0-9\s\-\/]/g, '').replace(/\s+/g,' ').trim();
}

function lookupStopId(stationName, line) {
  const feedKey = getFeedKey(line);
  const query   = normalise(stationName);

  // 1. Exact name match
  for (const entry of STATIONS) {
    if (entry.names.includes(query) && entry.stops[feedKey]) {
      return entry.stops[feedKey];
    }
  }
  // 2. Substring match
  for (const entry of STATIONS) {
    if (!entry.stops[feedKey]) continue;
    for (const n of entry.names) {
      if (query.includes(n) || n.includes(query)) return entry.stops[feedKey];
    }
  }
  return null;
}

// ─── GTFS-RT FETCH ───────────────────────────────────────────────────────────
// Cache raw feed buffers per feed key (expires after 30 s)
const feedCache = {};

async function fetchFeedBuffer(feedKey) {
  const now = Date.now();
  if (feedCache[feedKey] && now - feedCache[feedKey].ts < 30_000) {
    return feedCache[feedKey].buf;
  }
  const url = MTA_FEED_URLS[feedKey];
  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`MTA feed ${feedKey}: HTTP ${resp.status}`);
  const buf = await resp.arrayBuffer();
  feedCache[feedKey] = { buf, ts: now };
  return buf;
}

function decodeFeed(arrayBuffer) {
  if (!FeedMessage) throw new Error('protobuf not ready');
  return FeedMessage.decode(new Uint8Array(arrayBuffer));
}

// Fetch all upcoming departures (Unix seconds) for a stop on a given route.
// Tries both the N and S direction variants of the stop ID.
async function getLiveDepartures(baseStopId, routeId) {
  const feedKey = getFeedKey(routeId);
  try {
    const buf  = await fetchFeedBuffer(feedKey);
    const feed = decodeFeed(buf);
    const now  = Math.floor(Date.now() / 1000);
    const stopIds = [`${baseStopId}N`, `${baseStopId}S`];
    const departures = [];

    for (const entity of (feed.entity || [])) {
      const tu = entity.trip_update;
      if (!tu) continue;
      // Match route_id (the feed may suffix express variants, e.g. "6X")
      const rid = (tu.trip && tu.trip.route_id) ? String(tu.trip.route_id) : '';
      if (!rid.toUpperCase().startsWith(routeId.toUpperCase())) continue;

      for (const stu of (tu.stop_time_update || [])) {
        if (!stopIds.includes(stu.stop_id)) continue;
        const evt  = stu.departure || stu.arrival;
        if (!evt) continue;
        // protobuf.js encodes int64 as Long — convert to JS number
        const t = evt.time && typeof evt.time === 'object' ? evt.time.toNumber() : Number(evt.time);
        if (t > now) departures.push(t);
      }
    }
    return departures.sort((a, b) => a - b);
  } catch (err) {
    console.warn(`MTA live data unavailable (${feedKey}):`, err.message);
    return null; // signals "use scheduled"
  }
}

// ─── ROUTE PARSING ───────────────────────────────────────────────────────────
function parseRoute(gmRoute) {
  const leg   = gmRoute.legs[0];
  const steps = leg.steps;

  const parsedSteps = [];
  const transitLegs = [];

  for (const step of steps) {
    if (step.travel_mode === 'WALKING') {
      parsedSteps.push({
        type:         'WALK',
        durationSec:  step.duration.value,
        distanceText: step.distance ? step.distance.text : '',
      });
    } else if (step.travel_mode === 'TRANSIT') {
      const td  = step.transit;
      const line = normalizeLineName(td.line.short_name || td.line.name || '');
      const departTimeSec  = Math.round(+td.departure_time.value / 1000); // Date → Unix seconds
      const arrivalTimeSec = Math.round(+td.arrival_time.value  / 1000); // Date → Unix seconds

      const transitStep = {
        type:          'TRANSIT',
        line,
        headsign:      td.headsign || '',
        departStop:    td.departure_stop.name,
        arrivalStop:   td.arrival_stop.name,
        departTimeSec,
        arrivalTimeSec,
        numStops:      td.num_stops,
      };
      parsedSteps.push(transitStep);
      transitLegs.push(transitStep);
    }
  }

  // First walk duration used for "leave by" back-calculation
  const firstWalk = parsedSteps[0]?.type === 'WALK' ? parsedSteps[0] : null;

  return {
    steps:          parsedSteps,
    lines:          transitLegs.map(t => t.line),
    firstTransit:   transitLegs[0] || null,
    walkingSeconds: firstWalk?.durationSec ?? 0,
    arrivalTimeSec: Math.round(+leg.arrival_time.value / 1000), // Date → Unix seconds
    durationSec:    leg.duration.value,
  };
}

// Pick up to 3 routes from the Directions API response sorted by closeness to
// desiredArrivalSec, preferring earlier arrivals on ties.
function selectBestRoutes(gmRoutes, desiredArrivalSec) {
  if (!gmRoutes || gmRoutes.length === 0) return [];

  const scored = gmRoutes.map(r => {
    const arr  = Math.round(+r.legs[0].arrival_time.value / 1000); // Date → Unix seconds
    const diff = desiredArrivalSec - arr;
    return { r, arr, absDiff: Math.abs(diff), isEarly: diff >= 0 };
  });

  scored.sort((a, b) => {
    if (a.absDiff !== b.absDiff) return a.absDiff - b.absDiff;
    return (b.isEarly ? 1 : 0) - (a.isEarly ? 1 : 0);
  });

  return scored.slice(0, 3).map(s => s.r);
}

// ─── DIRECTIONS REQUEST ──────────────────────────────────────────────────────
function getDirections(origin, destination, arrivalDate) {
  return new Promise((resolve, reject) => {
    directionsService.route(
      {
        origin,
        destination,
        travelMode: google.maps.TravelMode.TRANSIT,
        transitOptions: {
          arrivalTime: arrivalDate,
          modes: [google.maps.TransitMode.SUBWAY],
        },
        provideRouteAlternatives: true,
      },
      (result, status) => {
        if (status === 'OK') resolve(result.routes);
        else reject(new Error(`Directions API: ${status}`));
      }
    );
  });
}

// ─── ARRIVAL TIME PARSING ─────────────────────────────────────────────────────
function parseArrivalTime(timeString) {
  const [h, m] = timeString.split(':').map(Number);
  const d = new Date();
  d.setHours(h, m, 0, 0);
  if (d <= new Date()) d.setDate(d.getDate() + 1); // use tomorrow if past
  return d;
}

// ─── UI HELPERS ──────────────────────────────────────────────────────────────
function formatTime(unixSec) {
  const d = new Date(unixSec * 1000);
  let h = d.getHours(), m = d.getMinutes();
  const ap = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  return `${h}:${String(m).padStart(2,'0')} ${ap}`;
}

function lineBulletHTML(line) {
  const color  = LINE_COLORS[line] || '#0039A6';
  const dark   = LIGHT_BG_LINES.has(line) ? 'color:#1a1a1a;' : '';
  return `<span class="line-bullet" style="background:${color};${dark}">${line}</span>`;
}

function showLoading(msg = 'Checking live train times…') {
  document.getElementById('loadingState').classList.remove('hidden');
  document.getElementById('loadingState').querySelector('p').textContent = msg;
  document.getElementById('errorState').classList.add('hidden');
  document.getElementById('results').classList.add('hidden');
}

function hideLoading() {
  document.getElementById('loadingState').classList.add('hidden');
}

function showError(msg) {
  hideLoading();
  const el = document.getElementById('errorState');
  el.classList.remove('hidden');
  el.querySelector('p').textContent = msg;
}

function renderResults(enrichedRoutes, desiredArrivalSec) {
  hideLoading();
  const container = document.getElementById('routeCards');
  container.innerHTML = '';

  // The recommended route is the one whose arrival is closest to desired
  // without going over.
  const onTime = enrichedRoutes.filter(r => r.arrivalTimeSec <= desiredArrivalSec);
  const recommended = onTime.length > 0
    ? onTime.reduce((a,b) => (desiredArrivalSec - a.arrivalTimeSec) < (desiredArrivalSec - b.arrivalTimeSec) ? a : b)
    : enrichedRoutes[0];

  for (const route of enrichedRoutes) {
    container.appendChild(renderRouteCard(route, route === recommended));
  }

  document.getElementById('results').classList.remove('hidden');
}

function renderRouteCard(route, isRecommended) {
  const { steps, lines, firstTransit, walkingSeconds, arrivalTimeSec, liveDepSec, schedDepSec } = route;
  const depSec   = liveDepSec ?? schedDepSec;
  const isLive   = liveDepSec != null;
  const leaveSec = depSec - walkingSeconds - bufferMin * 60;

  // Build itinerary rows
  let itinHTML = '';
  for (let i = 0; i < steps.length; i++) {
    const step   = steps[i];
    const isLast = i === steps.length - 1;

    if (step.type === 'WALK') {
      const walkMin = Math.max(1, Math.round(step.durationSec / 60));
      itinHTML += `
        <div class="itin-row">
          <div class="itin-left">
            <div class="itin-icon walk-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="5" r="1.5"/><path d="M9 19l1.5-5L8 11l3-3 2 3 3 1"/>
              </svg>
            </div>
            ${!isLast ? '<div class="itin-connector"></div>' : ''}
          </div>
          <div class="itin-body walk-body">
            Walk ${walkMin} min${step.distanceText ? ' · ' + escHtml(step.distanceText) : ''}
          </div>
        </div>`;

    } else if (step.type === 'TRANSIT') {
      const isFirst      = step === firstTransit;
      const thisDep      = isFirst ? depSec : step.departTimeSec;
      const thisIsLive   = isFirst && isLive;
      const color        = LINE_COLORS[step.line] || '#555';
      const darkText     = LIGHT_BG_LINES.has(step.line) ? 'color:#1a1a1a;' : '';
      // numStops includes the alighting stop; intermediate = numStops - 1
      const intermediate = Math.max(0, step.numStops - 1);

      // One dot per intermediate stop
      const dotRows = Array.from({ length: intermediate }, () =>
        '<div class="stop-dot"></div>'
      ).join('');

      itinHTML += `
        <div class="itin-row">
          <div class="itin-left">
            <div class="itin-bullet" style="background:${color};${darkText}">${escHtml(step.line)}</div>
            ${!isLast ? `<div class="itin-connector transit-connector" style="border-color:${color}"></div>` : ''}
          </div>
          <div class="itin-body transit-body">
            <div class="transit-station">
              <span class="station-name">${escHtml(step.departStop)}</span>
              <span class="${thisIsLive ? 'live-time' : 'sched-time'} station-time">${formatTime(thisDep)}</span>
              ${thisIsLive ? '<span class="live-badge">LIVE</span>' : '<span class="sched-badge">SCHEDULED</span>'}
            </div>
            <div class="transit-direction">toward <em>${escHtml(step.headsign)}</em></div>
            ${intermediate > 0 ? `
            <div class="stop-list">
              ${dotRows}
              <span class="stop-count-label">${intermediate} stop${intermediate !== 1 ? 's' : ''}</span>
            </div>` : ''}
            <div class="transit-station alight-station">
              <span class="station-name">${escHtml(step.arrivalStop)}</span>
              <span class="station-time sched-time">${formatTime(step.arrivalTimeSec)}</span>
            </div>
          </div>
        </div>`;
    }
  }

  // Final destination row
  itinHTML += `
    <div class="itin-row">
      <div class="itin-left">
        <div class="itin-icon dest-icon">📍</div>
      </div>
      <div class="itin-body dest-body">
        Arrive <strong>${formatTime(arrivalTimeSec)}</strong>
      </div>
    </div>`;

  const card = document.createElement('div');
  card.className = `route-card${isRecommended ? ' recommended' : ''}`;
  card.innerHTML = `
    ${isRecommended ? '<div class="rec-badge">Recommended</div>' : ''}
    <div class="route-lines">
      ${lines.map(lineBulletHTML).join('')}
    </div>
    <div class="leave-by">
      <span class="leave-label">Leave by</span>
      <span class="leave-time">${formatTime(leaveSec)}</span>
    </div>
    <div class="itinerary">${itinHTML}</div>`;

  return card;
}

function escHtml(str) {
  return (str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

// ─── GEOLOCATION ─────────────────────────────────────────────────────────────
function detectLocation() {
  const originInput  = document.getElementById('origin');
  const locBtn       = document.getElementById('locateBtn');
  locBtn.classList.add('spinning');
  originInput.value  = 'Detecting…';

  navigator.geolocation.getCurrentPosition(
    pos => {
      userCoords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
      originInput.value = `${userCoords.lat.toFixed(5)}, ${userCoords.lng.toFixed(5)}`;
      locBtn.classList.remove('spinning');
      // Try reverse-geocode for a friendly name
      const geocoder = new google.maps.Geocoder();
      geocoder.geocode({ location: userCoords }, (res, st) => {
        if (st === 'OK' && res[0]) {
          originInput.value = res[0].formatted_address;
        }
      });
    },
    () => {
      originInput.value = '';
      originInput.placeholder = 'Type your address…';
      locBtn.classList.remove('spinning');
    },
    { enableHighAccuracy: true, timeout: 8000 }
  );
}

// ─── FORM SUBMIT ─────────────────────────────────────────────────────────────
async function handleSearch(e) {
  e.preventDefault();

  const originText  = document.getElementById('origin').value.trim();
  const destText    = document.getElementById('destination').value.trim();
  const timeStr     = document.getElementById('arrivalTime').value;

  if (!originText)  { showError('Please enter your current location.'); return; }
  if (!destText)    { showError('Please enter a destination.'); return; }
  if (!timeStr)     { showError('Please select an arrival time.'); return; }

  const arrivalDate    = parseArrivalTime(timeStr);
  const arrivalTimeSec = Math.floor(arrivalDate.getTime() / 1000);
  const origin         = userCoords
    ? new google.maps.LatLng(userCoords.lat, userCoords.lng)
    : originText;

  showLoading('Finding routes…');

  let gmRoutes;
  try {
    gmRoutes = await getDirections(origin, destText, arrivalDate);
  } catch (err) {
    showError(`Could not find routes: ${err.message}`);
    return;
  }

  if (!gmRoutes || gmRoutes.length === 0) {
    showError('No transit routes found for this trip. Try a different destination or time.');
    return;
  }

  const best = selectBestRoutes(gmRoutes, arrivalTimeSec);

  showLoading('Fetching live MTA times…');

  // Enrich each route with live MTA departure data
  const enriched = await Promise.all(best.map(async gmRoute => {
    const parsed = parseRoute(gmRoute);
    let liveDepSec = null;

    if (parsed.firstTransit) {
      const { line, departStop, departTimeSec } = parsed.firstTransit;
      const stopId = lookupStopId(departStop, line);

      if (stopId) {
        const departures = await getLiveDepartures(stopId, line);
        if (departures && departures.length > 0) {
          // Pick the departure closest to (and within 5 min after) the scheduled time
          const window = departures.filter(t => Math.abs(t - departTimeSec) < 600);
          liveDepSec = window.length > 0 ? window[0] : departures[0];
        }
      }
    }

    return {
      ...parsed,
      liveDepSec,
      schedDepSec: parsed.firstTransit?.departTimeSec ?? arrivalTimeSec,
    };
  }));

  renderResults(enriched, arrivalTimeSec);
}

// ─── APP INIT (called by Google Maps callback) ────────────────────────────────
window.initApp = function () {
  // Init protobuf
  try {
    const root = protobuf.parse(GTFS_RT_PROTO, { keepCase: true }).root;
    FeedMessage = root.lookupType('transit_realtime.FeedMessage');
  } catch (err) {
    console.error('protobuf init failed:', err);
  }

  directionsService = new google.maps.DirectionsService();

  // Places Autocomplete on destination
  placesAutocomplete = new google.maps.places.Autocomplete(
    document.getElementById('destination'),
    { componentRestrictions: { country: 'us' }, fields: ['formatted_address','name'] }
  );

  // Default arrival time to 30 min from now
  const soon = new Date(Date.now() + 30 * 60 * 1000);
  const hh   = String(soon.getHours()).padStart(2,'0');
  const mm   = String(soon.getMinutes()).padStart(2,'0');
  document.getElementById('arrivalTime').value = `${hh}:${mm}`;

  // Buffer stepper
  updateBufferDisplay();
  document.getElementById('bufferDown').addEventListener('click', () => {
    if (bufferMin > 0) { bufferMin--; updateBufferDisplay(); }
  });
  document.getElementById('bufferUp').addEventListener('click', () => {
    if (bufferMin < 15) { bufferMin++; updateBufferDisplay(); }
  });

  // Save trip
  document.getElementById('saveTripBtn').addEventListener('click', openSaveModal);
  document.getElementById('modalCancel').addEventListener('click', closeSaveModal);
  document.getElementById('modalSave').addEventListener('click', confirmSaveTrip);
  document.getElementById('saveTripModal').addEventListener('click', e => {
    if (e.target === document.getElementById('saveTripModal')) closeSaveModal();
  });
  document.getElementById('tripName').addEventListener('keydown', e => {
    if (e.key === 'Enter') { e.preventDefault(); confirmSaveTrip(); }
  });

  // Render any previously saved trips
  renderSavedTrips();

  // Form & locate
  document.getElementById('plannerForm').addEventListener('submit', handleSearch);
  document.getElementById('locateBtn').addEventListener('click', detectLocation);

};

// ─── DYNAMIC GOOGLE MAPS LOAD ────────────────────────────────────────────────
(function loadGoogleMaps() {
  const s = document.createElement('script');
  s.src   = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_API_KEY}&libraries=places&callback=initApp&loading=async`;
  s.async = true;
  s.defer = true;
  s.onerror = () => showError('Failed to load Google Maps. Check your API key.');
  document.head.appendChild(s);
})();

// ─── SERVICE WORKER REGISTRATION ─────────────────────────────────────────────
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  });
}
