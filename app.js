// Portfolio Studio app code. Loaded by index.html as app.js?v=<APP_BUILD>; raise APP_BUILD here and the ?v= in
// index.html together with every change, so a browser never pairs a new page with an old cached script.
/*ENGINE_START*/
'use strict';
var KEY = 'portfolio-studio-v1';
var OLD_KEY = 'portfolio-manager-v1';
var PREFS_KEY = 'portfolio-studio-prefs';
var ORDER = ['stocks', 'k401', 'cds', 'cash', 'assets', 'mortgage'];
var SCEN = {
  cautious:   { label: 'Cautious',   mkt: -2.5, asset: -1.5 },
  base:       { label: 'Base',       mkt: 0,    asset: 0 },
  optimistic: { label: 'Optimistic', mkt: 2.5,  asset: 1 }
};

function uid() { return 'id' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4); }
function n(v) { var x = parseFloat(v); return isFinite(x) ? x : 0; }
function priced(r) { return r.price !== null && r.price !== undefined && r.price !== '' && isFinite(parseFloat(r.price)); }

function defaultSettings() {
  return { scenario: 'base', horizon: 15, stocksGrowth: 6.5, k401Growth: 6, stocksContrib: 6000, cashContrib: 3600, inflation: 2.5, real: false, monthlyExpenses: 4500, reserveMonths: 6, contribGrowth: 0, cdMode: 'savings', projView: 'combined',
    taxCapGains: 15, taxState: 0, taxInterest: 22, taxK401: 22, afterTax: false,
    goalAge: 50, goalRetireAge: 65, goalMonthly: 14167, goalRate: 4,
    planAge: 95, ssBenefit: 0, ssClaimAge: 67, ssSpouseBenefit: 0, ssSpouseAge: 50, ssSpouseClaimAge: 67, ssCut: 0, otherIncome: 0, otherStartAge: 65,
    autoSnap: true, histRange: 'all', histAfterTax: false, tickerMarket: true, mcVolStocks: 16, mcVol401: 12,
    concStock: 15, concIndustry: 40, concInsure: 250000, concCash: 25 };
}
function defaultFeed() {
  return { provider: 'finnhub', autoMins: 0, marketHoursOnly: true, lastRun: null };
}

function seed() {
  // Made-up sample data so the page has something to show before you add your own.
  var snap = Date.parse('2026-10-01T16:00:00-04:00');
  var raw = [
    ['VTI', 'Vanguard Total Stock Market ETF', 'ETF', 40, 210.00, 330.00],
    ['VXUS', 'Vanguard Total International Stock ETF', 'ETF', 80, 55.00, 68.00],
    ['BND', 'Vanguard Total Bond Market ETF', 'ETF', 50, 72.00, 74.00],
    ['AAPL', 'Apple Inc.', 'Stock', 25, 150.00, 330.00],
    ['MSFT', 'Microsoft Corp.', 'Stock', 15, 280.00, 515.00],
    ['KO', 'Coca-Cola Co.', 'Stock', 30, 58.00, 70.00],
    ['FXAIX', 'Fidelity 500 Index Fund', 'Mutual Fund', 20, 150.00, 225.00],
    ['PRIV', 'Example private company shares', 'Private', 100, 12.00, null]
  ];
  return {
    meta: { sample: true, savedAt: 0 },
    settings: defaultSettings(),
    feed: defaultFeed(),
    history: [],
    market: {},
    stocks: raw.map(function (r) {
      return { id: uid(), ticker: r[0], symbol: '', company: r[1], type: r[2], qty: r[3], cost: r[4], price: r[5],
        manual: r[5] === null, prevClose: null, quoteTime: r[5] === null ? null : snap, quoteSource: r[5] === null ? '' : 'Sample', quoteError: null };
    }),
    k401: [{ id: uid(), name: 'Employer 401(k)', balance: 86400, contrib: 16100 }],
    cds: [
      { id: uid(), name: 'Harbor Credit Union 12-month', principal: 10000, apy: 4.75, opened: '2026-03-12', matures: '2027-03-12' },
      { id: uid(), name: 'Summit Bank 24-month', principal: 10000, apy: 4.40, opened: '2025-11-05', matures: '2027-11-05' },
      { id: uid(), name: 'Lakeside Bank 60-month', principal: 5000, apy: 4.10, opened: '2025-06-20', matures: '2030-06-20' }
    ],
    cash: [
      { id: uid(), name: 'High-yield savings', balance: 18500, apy: 4.0 },
      { id: uid(), name: 'Everyday checking', balance: 4200, apy: 0 }
    ],
    assets: [
      { id: uid(), name: 'Home', value: 420000, growth: 3 },
      { id: uid(), name: 'Vehicle', value: 18000, growth: -10 }
    ],
    mortgage: [{ id: uid(), kind: 'Mortgage', name: 'Home mortgage', balance: 286500, rate: 3.75, payment: 1528.2 }]
  };
}

function normalize(s) {
  var out = {
    meta: Object.assign({ sample: false, savedAt: 0 }, s && s.meta),
    settings: Object.assign({}, defaultSettings(), s && s.settings),
    feed: Object.assign({}, defaultFeed(), s && s.feed),
    history: s && Array.isArray(s.history) ? s.history : [],
    market: s && s.market && typeof s.market === 'object' && !Array.isArray(s.market) ? s.market : {}
  };
  if (s && s.settings && s.settings.goalMonthly == null && s.settings.goalIncome != null) out.settings.goalMonthly = Math.round(n(s.settings.goalIncome) / 12);
  delete out.settings.goalIncome;
  ORDER.forEach(function (k) { out[k] = s && Array.isArray(s[k]) ? s[k] : []; });
  // Every item needs an id: sync uses ids to tell which items are new and which were deleted.
  ORDER.forEach(function (k) { out[k] = out[k].map(function (r) { return r && r.id ? r : Object.assign({}, r, { id: uid() }); }); });
  // Loans saved before loan types existed are mortgages.
  out.mortgage = out.mortgage.map(function (r) { return Object.assign({ kind: 'Mortgage' }, r); });
  out.stocks = out.stocks.map(function (r) {
    return Object.assign({ symbol: '', manual: false, prevClose: null, quoteTime: null, quoteSource: '', quoteError: null }, r);
  });
  return out;
}

function catValue(k, r) {
  switch (k) {
    case 'stocks': return priced(r) ? n(r.qty) * n(r.price) : 0;
    case 'k401': return n(r.balance);
    case 'cds': return cdValueNow(r);
    case 'cash': return n(r.balance);
    case 'assets': return n(r.value);
    case 'mortgage': return n(r.balance);
  }
  return 0;
}

function totals(s) {
  var t = {};
  ORDER.forEach(function (k) { t[k] = s[k].reduce(function (a, r) { return a + catValue(k, r); }, 0); });
  t.stockCost = s.stocks.reduce(function (a, r) { return a + n(r.qty) * n(r.cost); }, 0);
  t.stockCostPriced = s.stocks.reduce(function (a, r) { return a + (priced(r) ? n(r.qty) * n(r.cost) : 0); }, 0);
  t.stockGain = t.stocks - t.stockCostPriced;
  t.dayChange = 0; t.dayKnown = 0;
  s.stocks.forEach(function (r) {
    if (priced(r) && r.prevClose != null && isFinite(r.prevClose) && r.prevClose > 0) { t.dayChange += n(r.qty) * (n(r.price) - r.prevClose); t.dayKnown++; }
  });
  t.investable = t.stocks + t.k401 + t.cds + t.cash;
  t.totalAssets = t.investable + t.assets;
  t.liabilities = t.mortgage;
  t.net = t.totalAssets - t.liabilities;
  return t;
}

function wavg(items, balKey) {
  var tot = items.reduce(function (a, r) { return a + n(r[balKey]); }, 0);
  if (!tot) return 0;
  return items.reduce(function (a, r) { return a + n(r[balKey]) * n(r.apy); }, 0) / tot;
}

// Net worth history: one entry per day with the breakdown, so changes can be explained later.
function snapEntry(s, date) {
  var t = totals(s), tn = taxNow(s), r2 = function (v) { return Math.round(v * 100) / 100; };
  return { date: date, t: Date.now(), net: r2(t.net), netAfter: r2(t.net - tn.total), stocks: r2(t.stocks), k401: r2(t.k401), cds: r2(t.cds), cash: r2(t.cash), assets: r2(t.assets), mortgage: r2(t.mortgage), stockCost: r2(t.stockCostPriced) };
}
/* "What changed" by cause: splits the change in net worth since a snapshot into money you added, market moves,
   interest, loans paid down and property value. Needs the snapshot's stock cost basis (saved since build 2026100907).
   - Stocks: added = change in cost basis of priced holdings (buying raises it, selling lowers it); market = the rest.
   - 401(k): added = your yearly contributions setting, prorated over the period; market = the rest. If the balance
     wasn't updated in the period (no change), both are 0, since a stale balance says nothing about either.
   - Cash & CDs: interest = average balance × APY over the period (savings only if their balance changed, since CDs
     accrue by themselves); added = the rest (deposits less withdrawals; moves between savings and CDs cancel out).
   - Loans paid down = fall in loan balances. Property value = change in estimated values.
   The five parts always add up to the change in net worth. */
function changeCauses(s, base, days) {
  if (!base || base.stockCost == null) return null;
  var t = totals(s), yrs = Math.max(0, days) / 365.25, r2 = function (v) { return Math.round(v * 100) / 100; };
  var dS = t.stocks - base.stocks, addS = t.stockCostPriced - base.stockCost, mktS = dS - addS;
  var dK = t.k401 - base.k401, k4stale = Math.abs(dK) < 1, addK = k4stale ? 0 : s.k401.reduce(function (a, r) { return a + n(r.contrib); }, 0) * yrs, mktK = k4stale ? 0 : dK - addK;
  var growth = function (bal, apy) { return bal * (Math.pow(1 + apy / 100, yrs) - 1); };
  var cdApy = wavg(s.cds.map(function (c) { return { balance: cdValueNow(c), apy: c.apy }; }), 'balance');
  var dCash = t.cash - base.cash, cashStale = Math.abs(dCash) < 1;
  var intCd = growth((t.cds + base.cds) / 2, cdApy), intCash = cashStale ? 0 : growth((t.cash + base.cash) / 2, wavg(s.cash, 'balance'));
  var dC = t.cash + t.cds - base.cash - base.cds, interest = intCd + intCash, addC = dC - interest;
  return {
    added: addS + addK + addC, market: mktS + mktK, interest: interest, loans: base.mortgage - t.mortgage, property: t.assets - base.assets, total: t.net - base.net,
    addS: addS, addK: addK, addC: addC, mktS: mktS, mktK: mktK, k4stale: k4stale, cashStale: cashStale, yrs: yrs
  };
}
// Combine two histories by date; when both have a day, the entry recorded later wins.
function mergeHistory(a, b) {
  var map = {};
  (a || []).concat(b || []).forEach(function (e) {
    if (!e || !e.date) return;
    var cur = map[e.date];
    if (!cur || n(e.t) > n(cur.t)) map[e.date] = Object.assign({}, e, { manual: !!(e.manual || (cur && cur.manual)) });
  });
  return Object.keys(map).sort().map(function (k) { return map[k]; });
}

// Rough US tax model. State tax is added on top of each federal rate.
function taxRates(st) {
  var s = n(st.taxState);
  return { cap: (n(st.taxCapGains) + s) / 100, interest: (n(st.taxInterest) + s) / 100, k401: (n(st.taxK401) + s) / 100 };
}
// What you would owe if you sold every priced holding and withdrew the whole 401(k) today.
// Gains and losses across holdings net against each other; a net loss owes nothing.
function taxNow(s) {
  var t = totals(s), r = taxRates(s.settings);
  var stocks = Math.max(0, t.stockGain) * r.cap, k401 = t.k401 * r.k401;
  return { gain: t.stockGain, stocks: stocks, k401: k401, total: stocks + k401, rates: r };
}

// Social Security full retirement age by birth year (66 for 1954 and earlier, rising 2 months a year to 67 for 1960 and later).
function fraYears(birthYear) { return birthYear >= 1960 ? 67 : birthYear <= 1954 ? 66 : 66 + (birthYear - 1954) * 2 / 12; }
// Share of the full-retirement-age benefit when claiming at a given age (62-70): 5/9% less per month for the first
// 36 months early and 5/12% per month beyond that; 2/3% more per month of delay (8% a year) up to 70.
function ssFactor(claimAge, fra) {
  var c = Math.max(62, Math.min(70, claimAge)), m = Math.round((fra - c) * 12);
  if (m > 0) return 1 - (Math.min(m, 36) * 5 / 900 + Math.max(0, m - 36) * 5 / 1200);
  return 1 + (-m) * 2 / 300;
}
// Guaranteed retirement income, per month in today's dollars. Up to 85% of Social Security is taxable; other income is fully
// taxable. Both use the 401(k) withdrawal rate (plus state). startAge is always in terms of your own age.
function retireIncome(st) {
  var tax = taxRates(st).k401, cut = Math.min(100, Math.max(0, n(st.ssCut))) / 100, age = n(st.goalAge), yr = new Date().getFullYear(), out = [];
  var claim = function (c) { return Math.max(62, Math.min(70, n(c) || 67)); };
  if (n(st.ssBenefit) > 0) {
    var f = ssFactor(claim(st.ssClaimAge), fraYears(yr - age)), g = n(st.ssBenefit) * f * (1 - cut);
    out.push({ key: 'ss', label: 'Social Security', factor: f, gross: g, net: g * (1 - 0.85 * tax), claimAge: claim(st.ssClaimAge), startAge: claim(st.ssClaimAge) });
  }
  if (n(st.ssSpouseBenefit) > 0) {
    var sa = n(st.ssSpouseAge) || age, f2 = ssFactor(claim(st.ssSpouseClaimAge), fraYears(yr - sa)), g2 = n(st.ssSpouseBenefit) * f2 * (1 - cut);
    out.push({ key: 'spouse', label: 'Spouse’s Social Security', factor: f2, gross: g2, net: g2 * (1 - 0.85 * tax), claimAge: claim(st.ssSpouseClaimAge), startAge: age + (claim(st.ssSpouseClaimAge) - sa) });
  }
  if (n(st.otherIncome) > 0) out.push({ key: 'other', label: 'Other income', gross: n(st.otherIncome), net: n(st.otherIncome) * (1 - tax), startAge: n(st.otherStartAge) || n(st.goalRetireAge) });
  return out;
}

// Retirement goal: the yearly income you want (in today's dollars) divided by the withdrawal rate gives the
// savings target. Compared with investments and cash at retirement, after estimated taxes; home equity is left out.
function goalStatus(s) {
  var st = s.settings, yrs = Math.round(n(st.goalRetireAge) - n(st.goalAge));
  var rate = n(st.goalRate) / 100, monthly = n(st.goalMonthly), income = monthly * 12;
  if (yrs < 1 || !(rate > 0) || !(income > 0)) return { ok: false, yrs: yrs };
  var sim = Object.assign({}, s, { settings: Object.assign({}, st, { horizon: Math.min(40, yrs) }) });
  var rows = project(sim), r = rows[rows.length - 1];
  var infl = Math.pow(1 + n(st.inflation) / 100, r.y);
  var after = r.stocks + r.k401 + r.cds + r.cash - r.taxStocks - r.tax401;   // rows are nominal unless "today's dollars" is on
  // Guaranteed income lowers what savings must cover. Until each source starts, savings cover it too (the bridge).
  var streams = retireIncome(st), R = n(st.goalRetireAge);
  var guaranteed = streams.reduce(function (a, x) { return a + x.net * 12; }, 0);
  var bridge = streams.reduce(function (a, x) { return a + x.net * 12 * Math.max(0, x.startAge - R); }, 0);
  var fromSavings = Math.max(0, income - guaranteed);
  var targetToday = fromSavings / rate + bridge, target = st.real ? targetToday : targetToday * infl;
  var gap = target - after;
  // Extra amount per year, invested like the stocks, that would close the gap after capital-gains tax.
  var sc = SCEN[st.scenario] || SCEN.base, g = (n(st.stocksGrowth) + sc.mkt) / 100;
  if (st.real) g = (1 + g) / (1 + n(st.inflation) / 100) - 1;
  var ny = r.y, A = Math.abs(g) < 1e-9 ? ny : (Math.pow(1 + g, ny) - 1) / g;
  var perDollar = ny + (A - ny) * (1 - taxRates(st).cap);
  return {
    ok: true, yrs: ny, year: r.year, age: n(st.goalRetireAge), real: !!st.real, rate: rate, income: income, monthly: monthly,
    after: after, target: target, targetToday: targetToday, gap: gap,
    extra: gap > 0 && perDollar > 0 ? gap / perDollar : 0,
    streams: streams, guaranteed: guaranteed, bridge: bridge, fromSavings: fromSavings,
    incomeToday: Math.max(0, after * (st.real ? 1 : 1 / infl) - bridge) * rate + guaranteed
  };
}

// Age the lifetime plan runs to: 85-105, and always at least a year past retirement.
function planEnd(st) { return Math.max(Math.min(105, Math.max(85, Math.round(n(st.planAge)) || 95)), (Math.round(n(st.goalRetireAge)) || 65) + 1); }
// Lifetime plan in today's dollars, from now to the plan-until age (95 by default). Savings grow until retirement exactly as in Projections;
// after that, each year pays for spending not covered by guaranteed income. Withdrawals come from cash and CDs first,
// then stocks (capital-gains tax on the gain share), then the 401(k) (income tax). Home equity is never used.
function lifePlan(s) {
  var st = s.settings, END = planEnd(st), age0 = Math.round(n(st.goalAge)) || 50;
  var R = Math.min(END - 1, Math.max(age0 + 1, Math.round(n(st.goalRetireAge)) || 65));
  var sim = Object.assign({}, s, { settings: Object.assign({}, st, { real: true, horizon: Math.min(40, R - age0) }) });
  var acc = project(sim), tx = taxRates(st), sc = SCEN[st.scenario] || SCEN.base, inf = n(st.inflation) / 100;
  var real = function (g) { return (1 + g) / (1 + inf) - 1; };
  var gS = real((n(st.stocksGrowth) + sc.mkt) / 100), gK = real((n(st.k401Growth) + sc.mkt) / 100);
  var gC = real(wavg(s.cash, 'balance') / 100 * (1 - Math.min(0.99, tx.interest)));
  var streams = retireIncome(st), spend = n(st.goalMonthly) * 12;
  var ssAges = streams.filter(function (x) { return x.key !== 'other'; }).map(function (x) { return x.startAge; });
  var ssStart = ssAges.length ? Math.min.apply(null, ssAges) : null;
  var rows = acc.map(function (r) { return { age: age0 + r.y, year: r.year, cash: r.cash + r.cds, stocks: r.stocks, k401: r.k401, total: r.cash + r.cds + r.stocks + r.k401, phase: 'work', spend: 0, income: 0, fromSavings: 0, short: 0 }; });
  var last = acc[acc.length - 1], cash = last.cash + last.cds, stocks = last.stocks, k4 = last.k401;
  var basis = Math.max(0, last.stocks - last.gainStocks), ranOut = null;
  for (var a = R; a <= END; a++) {
    var row = { age: a, year: last.year + (a - R), cash: cash, stocks: stocks, k401: k4, total: cash + stocks + k4,
      phase: ssStart !== null && a < ssStart ? 'bridge' : 'retired' };
    var inc = streams.reduce(function (t, x) { return t + (a >= x.startAge ? x.net * 12 : 0); }, 0);
    var need = Math.max(0, spend - inc), got = 0, w;
    w = Math.min(cash, need); cash -= w; got += w; need -= w;
    if (need > 0.5 && stocks > 0) {
      var keep = 1 - Math.max(0, (stocks - basis) / stocks) * tx.cap, gross = Math.min(stocks, need / keep);
      basis -= basis * (gross / stocks); stocks -= gross; got += gross * keep; need -= gross * keep;
    }
    if (need > 0.5 && k4 > 0) {
      var keep2 = 1 - Math.min(0.99, tx.k401), gross2 = Math.min(k4, need / keep2);
      k4 -= gross2; got += gross2 * keep2; need -= gross2 * keep2;
    }
    if (need > 1 && ranOut === null) ranOut = a;
    row.spend = spend; row.income = inc; row.fromSavings = got; row.short = Math.max(0, need);
    if (a === R) rows[rows.length - 1] = row; else rows.push(row);
    cash *= 1 + gC; stocks *= 1 + gS; k4 *= 1 + gK; basis /= 1 + inf;   // basis is fixed in dollars, so it shrinks in today's dollars
  }
  return { endAge: END, rows: rows, age0: age0, R: R, ssStart: ssStart, ranOut: ranOut, end: rows[rows.length - 1].total, spend: spend, streams: streams };
}

/* Monte Carlo "chance of success": the lifetime plan above, replayed in many simulated markets where each year's return
   is random instead of steady. Everything else is the same plan: contributions while working (taken from the steady
   projection), then the same withdrawals, order and taxes in retirement, in today's dollars to the plan-until age.
   - Yearly real returns are lognormal with the median at the plan's steady rate, so the middle future follows the
     steady plan and the bands show the luck around it. Swings are the settings "How much stocks / the 401(k) swing".
   - The 401(k) moves with stocks (correlation 0.85). Cash and CDs don't swing.
   - A fixed random seed makes the result repeatable: the same plan always gives the same percentage.
   Success = savings cover all spending in every year to the plan-until age. */
var MC_PATHS = 1000, MC_RHO = 0.85, mcCache = {}, mcKeys = [];
function mcRand(seed) {   // mulberry32 with Box-Muller normals
  var a = seed >>> 0, spare = null;
  var u = function () { a = (a + 0x6D2B79F5) >>> 0; var t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  return function () {
    if (spare !== null) { var x = spare; spare = null; return x; }
    var r, v1, v2; do { v1 = u() * 2 - 1; v2 = u() * 2 - 1; r = v1 * v1 + v2 * v2; } while (r >= 1 || r === 0);
    var f = Math.sqrt(-2 * Math.log(r) / r); spare = v2 * f; return v1 * f;
  };
}
function monteCarlo(s) {
  var st = s.settings;
  var key = JSON.stringify([st, ORDER.map(function (k) { return s[k]; })]);
  if (mcCache[key]) return mcCache[key];
  var END = planEnd(st), age0 = Math.round(n(st.goalAge)) || 50;
  var R = Math.min(END - 1, Math.max(age0 + 1, Math.round(n(st.goalRetireAge)) || 65));
  var sim = Object.assign({}, s, { settings: Object.assign({}, st, { real: true, horizon: Math.min(40, R - age0) }) });
  var acc = project(sim), tx = taxRates(st), sc = SCEN[st.scenario] || SCEN.base, inf = n(st.inflation) / 100;
  var real = function (g) { return (1 + g) / (1 + inf) - 1; };
  var gS = real((n(st.stocksGrowth) + sc.mkt) / 100), gK = real((n(st.k401Growth) + sc.mkt) / 100);
  var gC = real(wavg(s.cash, 'balance') / 100 * (1 - Math.min(0.99, tx.interest)));
  var sig = function (v, g) { v = Math.max(0, n(v)) / 100; return Math.sqrt(Math.log(1 + v * v / ((1 + g) * (1 + g)))); };
  var sS = sig(st.mcVolStocks, gS), sK = sig(st.mcVol401, gK), rho = MC_RHO, rho2 = Math.sqrt(1 - rho * rho);
  var streams = retireIncome(st), spend = n(st.goalMonthly) * 12;
  // What the steady plan adds each working year, so random returns can be applied to the same contributions.
  var addS = [], addK = [];
  for (var y = 0; y + 1 < acc.length; y++) { addS.push(acc[y + 1].stocks - acc[y].stocks * (1 + gS)); addK.push(acc[y + 1].k401 - acc[y].k401 * (1 + gK)); }
  var last = acc[acc.length - 1], basisR = Math.max(0, last.stocks - last.gainStocks);
  var ages = []; for (var a0 = age0; a0 <= END; a0++) ages.push(a0);
  var A = ages.length, totals = ages.map(function () { return new Float64Array(MC_PATHS); }), alive = new Float64Array(A), outAge = [];
  var Z = mcRand(20261009);
  for (var p = 0; p < MC_PATHS; p++) {
    var S = acc[0].stocks, K = acc[0].k401, C, failed = null, i = 0;
    for (y = 0; y < acc.length - 1; y++, i++) {
      totals[i][p] = S + K + acc[y].cash + acc[y].cds; alive[i]++;
      var z1 = Z(), z2 = rho * z1 + rho2 * Z();
      S = Math.max(0, S * (1 + gS) * Math.exp(sS * z1) + addS[y]); K = Math.max(0, K * (1 + gK) * Math.exp(sK * z2) + addK[y]);
    }
    C = last.cash + last.cds;
    var basis = Math.min(basisR, S);
    for (var a = R; a <= END; a++, i++) {
      totals[i][p] = C + S + K;   // like the lifetime plan: what's there at the start of the year, before that year's spending
      var inc = 0; for (var j = 0; j < streams.length; j++) if (a >= streams[j].startAge) inc += streams[j].net * 12;
      var need = Math.max(0, spend - inc), w = Math.min(C, need); C -= w; need -= w;
      if (need > 0.5 && S > 0) { var keep = 1 - Math.max(0, (S - basis) / S) * tx.cap, gross = Math.min(S, need / keep); basis -= basis * (gross / S); S -= gross; need -= gross * keep; }
      if (need > 0.5 && K > 0) { var keep2 = 1 - Math.min(0.99, tx.k401), gross2 = Math.min(K, need / keep2); K -= gross2; need -= gross2 * keep2; }
      if (need > 1 && failed === null) failed = a;
      if (failed === null) alive[i]++;
      var r1 = Z(), r2 = rho * r1 + rho2 * Z();
      C *= 1 + gC; S *= (1 + gS) * Math.exp(sS * r1); K *= (1 + gK) * Math.exp(sK * r2); basis /= 1 + inf;
    }
    outAge.push(failed === null ? END + 1 : failed);
  }
  var q = function (arr, f) { var b = Array.prototype.slice.call(arr).sort(function (x, y) { return x - y; }); return b[Math.min(b.length - 1, Math.floor(f * b.length))]; };
  var rows = ages.map(function (age, k) {
    return { age: age, p10: q(totals[k], 0.1), p25: q(totals[k], 0.25), p50: q(totals[k], 0.5), p75: q(totals[k], 0.75), p90: q(totals[k], 0.9), alive: alive[k] / MC_PATHS };
  });
  outAge.sort(function (x, y) { return x - y; });
  var ok = outAge.filter(function (x) { return x > END; }).length;
  var res = { paths: MC_PATHS, endAge: END, R: R, age0: age0, rows: rows, success: ok / MC_PATHS, worst10: outAge[Math.floor(0.1 * MC_PATHS)] > END ? null : outAge[Math.floor(0.1 * MC_PATHS)],
    medianOut: outAge[Math.floor(0.5 * MC_PATHS)] > END ? null : outAge[Math.floor(0.5 * MC_PATHS)], p10End: rows[rows.length - 1].p10 };
  mcCache[key] = res; mcKeys.push(key); if (mcKeys.length > 12) delete mcCache[mcKeys.shift()];
  return res;
}

/* Concentration checks: places where too much depends on one thing. Each finding carries the numbers and the ids of
   the items involved (for highlighting); the page turns them into words. level 'warn' = worth a look, 'info' = context.
   1. One company: a stock or private holding (same ticker combined) above concStock % of investments (stocks & funds + 401(k)).
      Funds (ETF, Mutual Fund) are already spread out and aren't flagged.
   2. One industry: with 3+ individual stocks whose industry is known, the largest industry above concIndustry % of them.
   3. Insurance limit: CDs (value today) plus savings at one bank above concInsure. Grouped by the Bank field, else the name.
   4. Property share (info): property minus loans above half of net worth.
   5. Cash above reserve: savings and CDs beyond the cash reserve worth more than concCash % of investable money. */
function concFindings(s) {
  var st = s.settings, t = totals(s), out = [], inv = t.stocks + t.k401;
  var by = {};
  s.stocks.forEach(function (r) {
    if (!priced(r) || (r.type !== 'Stock' && r.type !== 'Private')) return;
    var k = String(r.ticker || '').toUpperCase(); if (!k) return;
    by[k] = by[k] || { ticker: k, company: r.company || '', v: 0, ids: [] }; by[k].v += n(r.qty) * n(r.price); by[k].ids.push(r.id);
  });
  var lim = n(st.concStock) / 100;
  if (inv > 0 && lim > 0) Object.keys(by).forEach(function (k) {
    var x = by[k], share = x.v / inv;
    if (share > lim) out.push({ key: 'stock-' + k, level: 'warn', kind: 'stock', ticker: k, company: x.company, value: x.v, share: share, limit: lim, base: inv, ids: x.ids });
  });
  out.sort(function (a, b) { return b.share - a.share; });
  var ind = {}, indTot = 0, nInd = 0;
  s.stocks.forEach(function (r) {
    if (!priced(r) || r.type !== 'Stock' || !r.industry) return;
    var v = n(r.qty) * n(r.price); ind[r.industry] = ind[r.industry] || { v: 0, ids: [], n: 0 }; ind[r.industry].v += v; ind[r.industry].ids.push(r.id); ind[r.industry].n++; indTot += v; nInd++;
  });
  var top = Object.keys(ind).sort(function (a, b) { return ind[b].v - ind[a].v; })[0], ilim = n(st.concIndustry) / 100;
  if (nInd >= 3 && indTot > 0 && ilim > 0 && ind[top].v / indTot > ilim) out.push({ key: 'industry', level: 'warn', kind: 'industry', industry: top, value: ind[top].v, share: ind[top].v / indTot, limit: ilim, count: ind[top].n, of: nInd, base: indTot, ids: ind[top].ids });
  var banks = {}, cap = n(st.concInsure);
  var add = function (r, v, cat) {
    var label = String(r.bank || r.name || '').trim(), k = label.toLowerCase(); if (!k) return;
    banks[k] = banks[k] || { bank: label, v: 0, cds: 0, accts: 0, ids: [], named: !!r.bank }; banks[k].v += v; banks[k][cat]++; banks[k].ids.push(r.id);
  };
  s.cds.forEach(function (r) { add(r, cdValueNow(r), 'cds'); });
  s.cash.forEach(function (r) { add(r, n(r.balance), 'accts'); });
  if (cap > 0) Object.keys(banks).forEach(function (k) {
    var b = banks[k]; if (b.v > cap) out.push({ key: 'bank-' + k, level: 'warn', kind: 'bank', bank: b.bank, value: b.v, over: b.v - cap, limit: cap, cds: b.cds, accts: b.accts, ids: b.ids });
  });
  var unnamed = s.cds.concat(s.cash).filter(function (r) { return !String(r.bank || '').trim(); }).length;
  var equity = t.assets - t.mortgage;
  if (t.net > 0 && equity > 0 && equity / t.net > 0.5) out.push({ key: 'property', level: 'info', kind: 'property', value: equity, share: equity / t.net, net: t.net, ids: s.assets.map(function (r) { return r.id; }) });
  var reserve = n(st.monthlyExpenses) * n(st.reserveMonths), cashAll = t.cash + t.cds, extra = cashAll - reserve, clim = n(st.concCash) / 100;
  if (reserve > 0 && clim > 0 && t.investable > 0 && extra > clim * t.investable) out.push({ key: 'cash', level: 'warn', kind: 'cash', value: cashAll, reserve: reserve, extra: extra, times: cashAll / reserve, share: extra / t.investable, limit: clim, months: n(st.reserveMonths), ids: s.cds.concat(s.cash).map(function (r) { return r.id; }) });
  out.unnamedBanks = unnamed;
  return out;
}

// One row per year; each step is 12 months from today.
// Rows also carry running totals of contributions and of CD money moved to savings, so each account's
// growth can be split into "what you put in" and "what it earned".
// Interest is taxed every year, so savings and CDs grow after tax. Stock gains and 401(k) money are taxed
// only when cashed out, so each row also carries the tax that would be due if everything were sold that year.
function project(s) {
  var st = s.settings;
  var sc = SCEN[st.scenario] || SCEN.base;
  var horizon = Math.max(1, Math.min(40, Math.round(n(st.horizon)) || 15));
  var t = totals(s);
  var stocks = t.stocks, k4 = t.k401, cash = t.cash;
  var cashRate = wavg(s.cash, 'balance') / 100, cg = n(st.contribGrowth) / 100;
  var toSavings = st.cdMode !== 'renew';
  var tx = taxRates(st), ti = Math.min(0.99, Math.max(0, tx.interest)), basis = t.stockCostPriced;
  var taxOf = function (net) { return net * ti / (1 - ti); };
  var k4Contrib = s.k401.reduce(function (a, r) { return a + n(r.contrib); }, 0);
  var cdList = s.cds.map(function (r) { var m = parseDate(r.matures); return { v: cdValueNow(r), a: n(r.apy) / 100, m: m ? m.getTime() : null }; });
  var assets = s.assets.map(function (r) { return { v: n(r.value), g: n(r.growth) }; });
  var loans = s.mortgage.map(function (r) { return { b: n(r.balance), r: n(r.rate) / 1200, p: n(r.payment) }; });
  var now = Date.now(), YEAR = 365.25 * 864e5, thisYear = new Date().getFullYear();
  var cum = { stocks: 0, k401: 0, cash: 0, cdToCash: 0, intCash: 0, intCds: 0 };
  var rows = [];

  function defl(y) { return st.real ? Math.pow(1 + n(st.inflation) / 100, y) : 1; }
  function snap(y) {
    var d = defl(y);
    var cds = cdList.reduce(function (a, c) { return a + c.v; }, 0);
    var av = assets.reduce(function (a, x) { return a + x.v; }, 0);
    var mt = loans.reduce(function (a, x) { return a + x.b; }, 0);
    var taxS = Math.max(0, stocks - basis) * tx.cap, taxK = k4 * tx.k401;
    rows.push({
      y: y, year: thisYear + y,
      stocks: stocks / d, k401: k4 / d, cds: cds / d, cash: cash / d,
      assets: av / d, mortgage: mt / d,
      net: (stocks + k4 + cds + cash + av - mt) / d,
      cStocks: cum.stocks, cK401: cum.k401, cCash: cum.cash, cdToCash: cum.cdToCash,
      taxStocks: taxS / d, tax401: taxK / d, netAfter: (stocks + k4 + cds + cash + av - mt - taxS - taxK) / d,
      gainStocks: (stocks - basis) / d, intTaxCash: cum.intCash, intTaxCds: cum.intCds
    });
  }
  snap(0);
  for (var y = 1; y <= horizon; y++) {
    var d = defl(y), f = Math.pow(1 + cg, y - 1);
    var addS = n(st.stocksContrib) * f, addK = k4Contrib * f, addC = n(st.cashContrib) * f;
    stocks = stocks * (1 + (n(st.stocksGrowth) + sc.mkt) / 100) + addS;
    basis += addS;
    k4 = k4 * (1 + (n(st.k401Growth) + sc.mkt) / 100) + addK;
    var cashInt = cash * cashRate * (1 - ti);
    cum.intCash += taxOf(cashInt) / d;
    cash = cash + cashInt + addC;
    cum.stocks += addS / d; cum.k401 += addK / d; cum.cash += addC / d;
    var stepStart = now + (y - 1) * YEAR, stepEnd = now + y * YEAR;
    cdList.forEach(function (c) {
      if (!c.v) return;
      if (toSavings && c.m !== null && c.m <= stepEnd) {
        // Grows at its APY until maturity, then earns the savings rate for the rest of the year.
        var frac = Math.max(0, Math.min(1, (c.m - stepStart) / YEAR));
        var out = c.v * Math.pow(1 + c.a * (1 - ti), frac);
        var moved = out * Math.pow(1 + cashRate * (1 - ti), 1 - frac);
        cum.intCds += taxOf(out - c.v) / d;
        cum.intCash += taxOf(moved - out) / d;
        cash += moved;
        cum.cdToCash += out / d;
        c.v = 0;
      } else {
        var g = c.v * c.a * (1 - ti);
        cum.intCds += taxOf(g) / d;
        c.v += g;
      }
    });
    assets.forEach(function (x) { x.v = x.v * (1 + (x.g + sc.asset) / 100); });
    loans.forEach(function (x) {
      for (var m = 0; m < 12; m++) {
        if (x.b <= 0) { x.b = 0; break; }
        x.b = Math.max(0, x.b + x.b * x.r - x.p);
      }
    });
    snap(y);
  }
  return rows;
}

function parseDate(str) {
  var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(str || '');
  return m ? new Date(+m[1], +m[2] - 1, +m[3]) : null;
}

function cdAtMaturity(r) {
  var o = parseDate(r.opened), m = parseDate(r.matures);
  if (!o || !m || m <= o) return null;
  var years = (m - o) / (365.25 * 864e5);
  return n(r.principal) * Math.pow(1 + n(r.apy) / 100, years);
}

// Today's value of a CD: principal plus interest compounded at its APY since it opened, stopping at maturity.
function cdValueNow(r, at) {
  var o = parseDate(r.opened), m = parseDate(r.matures), now = at || new Date();
  if (!o || now <= o) return n(r.principal);
  var end = m && m < now ? m : now;
  return n(r.principal) * Math.pow(1 + n(r.apy) / 100, (end - o) / (365.25 * 864e5));
}

function payoffMonths(r) {
  var B = n(r.balance), P = n(r.payment), i = n(r.rate) / 1200;
  if (B <= 0) return 0;
  if (P <= 0) return null;
  if (i === 0) return Math.ceil(B / P);
  if (P <= B * i) return null;
  return Math.ceil(-Math.log(1 - (B * i) / P) / Math.log(1 + i));
}

function niceStep(x) {
  if (!(x > 0)) return 1;
  var p = Math.pow(10, Math.floor(Math.log(x) / Math.LN10));
  var f = x / p;
  return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10) * p;
}

// US regular session, Mon–Fri 9:30–16:00 New York time (exchange holidays not included).
function marketOpen(date) {
  var parts = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', weekday: 'short', hour: 'numeric', minute: 'numeric', hourCycle: 'h23' }).formatToParts(date || new Date());
  var p = {};
  parts.forEach(function (x) { p[x.type] = x.value; });
  if (p.weekday === 'Sat' || p.weekday === 'Sun') return false;
  var mins = (+p.hour % 24) * 60 + +p.minute;
  return mins >= 570 && mins <= 965;
}
// Time of the most recent weekday 4:05 PM New York close at or before `date` (exchange holidays not included).
// Used to take one refresh after each close, so the day's prices end on closing prices.
function lastClose(date) {
  var now = date || new Date();
  // New York wall-clock parts and UTC offset at a given moment (handles daylight saving time).
  var ny = function (t) {
    var p = {};
    new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric', second: 'numeric', hourCycle: 'h23' })
      .formatToParts(new Date(t)).forEach(function (x) { p[x.type] = x.value; });
    p.off = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour % 24, +p.minute, +p.second) - Math.floor(t / 1000) * 1000;
    return p;
  };
  var p = ny(now.getTime());
  for (var k = 0; k < 8; k++) {
    var d = new Date(Date.UTC(+p.year, +p.month - 1, +p.day - k)), wd = d.getUTCDay();
    if (wd === 0 || wd === 6) continue;
    var wall = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 16, 5);
    var ts = wall - ny(wall - p.off).off;   // use that day's own offset
    if (ts <= now.getTime()) return ts;
  }
  return 0;
}

/* ---------- price feeds ---------- */
function feedErr(msg, fatal) { var e = new Error(msg); e.fatal = !!fatal; return e; }
function fetchJson(url) {
  var ctl = typeof AbortController !== 'undefined' ? new AbortController() : null;
  var timer = setTimeout(function () { if (ctl) ctl.abort(); }, 12000);
  return fetch(url, { signal: ctl ? ctl.signal : undefined, cache: 'no-store' }).then(function (res) {
    clearTimeout(timer);
    if (res.status === 401) throw feedErr('The API key was rejected. Check it in Settings.', true);
    if (res.status === 429) throw feedErr('Rate limit reached. Try again in a minute.', true);
    if (res.status === 403) throw feedErr('This symbol is not available on your plan.');
    if (!res.ok) throw feedErr('Price service error (' + res.status + ').');
    return res.json();
  }, function (e) {
    clearTimeout(timer);
    throw feedErr(e && e.name === 'AbortError' ? 'The price service did not respond.' : 'Could not reach the price service. Check your connection.', true);
  });
}
var FEEDS = {
  finnhub: {
    label: 'Finnhub', signup: 'https://finnhub.io/register', gap: 1100,
    note: 'Free key, up to 60 requests a minute. Covers US stocks and ETFs; some mutual funds are not included on the free plan.',
    quote: function (sym, key) {
      return fetchJson('https://finnhub.io/api/v1/quote?symbol=' + encodeURIComponent(sym) + '&token=' + encodeURIComponent(key)).then(function (j) {
        if (j && j.error) throw feedErr(String(j.error), /key|token/i.test(j.error));
        if (!j || !j.c) throw feedErr('No quote found for ' + sym + '.');
        return { price: +j.c, prevClose: j.pc ? +j.pc : null };
      });
    }
  },
  alphavantage: {
    label: 'Alpha Vantage', signup: 'https://www.alphavantage.co/support/#api-key', gap: 12500,
    note: 'Free key, 25 requests a day and 5 a minute, so refreshing 14 holdings takes about 3 minutes and uses most of the day’s allowance. Covers mutual funds.',
    quote: function (sym, key) {
      return fetchJson('https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=' + encodeURIComponent(sym) + '&apikey=' + encodeURIComponent(key)).then(function (j) {
        var info = j && (j.Note || j.Information);
        if (info) throw feedErr(String(info).slice(0, 160), true);
        if (j && j['Error Message']) throw feedErr('No quote found for ' + sym + '.');
        var q = j && j['Global Quote'];
        if (!q || !q['05. price']) throw feedErr('No quote found for ' + sym + '.');
        return { price: +q['05. price'], prevClose: q['08. previous close'] ? +q['08. previous close'] : null };
      });
    }
  }
};
// Market reference symbols shown first in the Overview ticker (Settings › Live price feed can turn them off).
var MARKET = [['SPY', 'S&P 500'], ['QQQ', 'Nasdaq-100']];
/*ENGINE_END*/

(function () {
  var $ = function (sel) { return document.querySelector(sel); };
  var usd0 = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
  var usd2 = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 });
  /* Hide amounts (per device, the eye button at the top of every page): every dollar amount of yours shows as
     $•••••. Signs and colors stay, so ups and downs still read. Market prices per share, percentages and exports
     are not masked; share quantities are, since quantity times price would give the amount away. */
  var MASK = '•••••';
  function hiding() { return !!(typeof prefs !== 'undefined' && prefs && prefs.hide); }
  function money0(v) { return (v < 0 ? '−' : '') + (hiding() ? '$' + MASK : usd0.format(Math.abs(v))); }
  function money2(v) { return (v < 0 ? '−' : '') + (hiding() ? '$' + MASK : usd2.format(Math.abs(v))); }
  function signed(v, f) { return (v < 0 ? '−' : '+') + (hiding() ? '$' + MASK : (f || usd0).format(Math.abs(v))); }
  // Market prices per share are public, so they always show.
  function px(v) { return (v < 0 ? '−' : '') + usd2.format(Math.abs(v)); }
  function pxSigned(v) { return (v < 0 ? '−' : '+') + usd2.format(Math.abs(v)); }
  function qtyTxt(v) { return hiding() ? '•••' : n(v).toLocaleString('en-US', { maximumFractionDigits: 4 }); }
  function pct(v, d) { return (v < 0 ? '−' : '') + Math.abs(v).toFixed(d == null ? 1 : d) + '%'; }
  function sgnPct(v) { return (v < 0 ? '−' : '+') + Math.abs(v).toFixed(1) + '%'; }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function short(v) {
    var a = Math.abs(v), s = v < 0 ? '−$' : '$';
    if (hiding()) return s + '•••';
    if (a === 0) return '$0';
    if (a >= 1e6) return s + (+(a / 1e6).toFixed(2)) + 'M';
    return s + Math.round(a / 1e3) + 'K';
  }
  function fmtDate(str) {
    var d = parseDate(str);
    return d ? d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—';
  }
  function today() {
    var d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }
  function when(ts) {
    if (!ts) return '';
    var d = new Date(ts);
    return d.toDateString() === new Date().toDateString()
      ? d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
      : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }
  var ICON = {
    overview: '<path d="M4 13h6V4H4v9Zm10 7h6V11h-6v9ZM4 20h6v-3H4v3Zm10-13h6V4h-6v3Z"/>',
    stocks: '<path d="M5 18V9m7 9V5m7 13v-6"/><path d="M3 18h18"/>',
    accounts: '<path d="M4 19h16M6 16V9m4 7V5m4 11v-4m4 4V7"/>',
    projections: '<path d="m4 17 5-5 4 3 7-9"/><path d="M15 6h5v5"/>',
    insights: '<path d="M9 18h6M10 21h4"/><path d="M12 3a6 6 0 0 0-3.6 10.8c.7.6 1.1 1.3 1.1 2.2h5c0-.9.4-1.6 1.1-2.2A6 6 0 0 0 12 3z"/>',
    settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
    eye: '<path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
    eyeOff: '<path d="M3 3l18 18"/><path d="M10.6 5.1A10.4 10.4 0 0 1 12 5c6.4 0 10 7 10 7a17.6 17.6 0 0 1-3.2 4.1M6.6 6.6C3.9 8.4 2 12 2 12s3.6 7 10 7a10 10 0 0 0 5.4-1.6"/><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2"/>',
    refresh: '<path d="M21 12a9 9 0 1 1-2.6-6.4"/><path d="M21 4v5h-5"/>',
    k401: '<path d="M5 20V9l7-5 7 5v11M9 20v-5h6v5"/>',
    cds: '<circle cx="12" cy="12" r="8"/><path d="M12 8v4l3 2"/>',
    cash: '<path d="M4 8h16v10H4zM7 8V6h10v2M8 13h4"/>',
    assets: '<path d="M4 20V10l8-6 8 6v10M8 20v-7h8v7"/>',
    mortgage: '<path d="M5 18h14M7 18V9l5-4 5 4v9"/>'
  };
  function icon(k, cls) { return '<svg' + (cls ? ' class="' + cls + '"' : '') + ' aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">' + ICON[k] + '</svg>'; }

  var LOAN_KINDS = ['Mortgage', 'Auto', 'Student', 'Personal', 'Other'];
  var CATS = {
    stocks: { label: 'Stocks & funds', one: 'position', fields: [
      { key: 'ticker', label: 'Ticker', type: 'text', req: true },
      { key: 'company', label: 'Company or fund name', type: 'text' },
      { key: 'type', label: 'Type', type: 'select', options: ['Stock', 'ETF', 'Mutual Fund', 'Bond', 'Private', 'Other'] },
      { key: 'qty', label: 'Quantity (shares)', type: 'number', min: 0, req: true },
      { key: 'cost', label: 'Purchase price per share ($)', type: 'number', min: 0, req: true },
      { key: 'price', label: 'Current price per share ($)', type: 'number', min: 0, nullable: true, hint: 'Leave blank if there is no market price, such as a private holding. A live refresh fills this in.' },
      { key: 'manual', label: 'I’ll enter the price myself (skip live refresh)', type: 'checkbox' },
      { key: 'symbol', label: 'Feed symbol', type: 'text', hint: 'Only needed when the price feed uses a different symbol than the ticker, for example BRK.B.' }
    ] },
    k401: { label: '401(k)', one: '401(k) account', fields: [
      { key: 'name', label: 'Account name', type: 'text', req: true },
      { key: 'balance', label: 'Current balance ($)', type: 'number', min: 0, req: true },
      { key: 'contrib', label: 'Total contributions per year ($)', type: 'number', min: 0, hint: 'Yours plus any employer match. Used in projections.' }
    ] },
    cds: { label: 'CDs', one: 'CD', fields: [
      { key: 'name', label: 'Name or institution', type: 'text', req: true },
      { key: 'principal', label: 'Principal ($)', type: 'number', min: 0, req: true },
      { key: 'apy', label: 'APY (%)', type: 'number', min: 0, req: true },
      { key: 'opened', label: 'Opened', type: 'date' },
      { key: 'term', label: 'Term (months)', type: 'number', min: 1, nullable: true, hint: 'Fills in the maturity date from the opened date. Changing the maturity date updates the term.' },
      { key: 'matures', label: 'Matures', type: 'date' },
      { key: 'bank', label: 'Bank or credit union', type: 'text', hint: 'Groups what you hold at each bank for the $250,000 insurance check in Insights. Use the same spelling on each CD and account at that bank.' }
    ] },
    cash: { label: 'Savings & checking', one: 'account', fields: [
      { key: 'name', label: 'Account name', type: 'text', req: true },
      { key: 'balance', label: 'Balance ($)', type: 'number', min: 0, req: true },
      { key: 'apy', label: 'APY (%)', type: 'number', min: 0 },
      { key: 'bank', label: 'Bank or credit union', type: 'text', hint: 'Groups what you hold at each bank for the $250,000 insurance check in Insights. Use the same spelling on each CD and account at that bank.' }
    ] },
    assets: { label: 'Property & assets', one: 'asset', fields: [
      { key: 'name', label: 'Asset', type: 'text', req: true },
      { key: 'value', label: 'Estimated value ($)', type: 'number', min: 0, req: true },
      { key: 'growth', label: 'Expected change per year (%)', type: 'number', hint: 'Use a negative number for things that lose value, such as a vehicle.' }
    ] },
    mortgage: { label: 'Loans', one: 'loan', fields: [
      { key: 'kind', label: 'Type', type: 'select', options: LOAN_KINDS, req: true },
      { key: 'name', label: 'Loan name', type: 'text', req: true, hint: 'For example "Home mortgage" or "Car loan".' },
      { key: 'balance', label: 'Balance owed ($)', type: 'number', min: 0, req: true },
      { key: 'rate', label: 'Interest rate (%)', type: 'number', min: 0, req: true },
      { key: 'payment', label: 'Monthly payment, principal and interest ($)', type: 'number', min: 0, req: true }
    ] }
  };

  /* ---------- storage ---------- */
  // Raise APP_BUILD with every published change. Saves record the build that wrote them, and a copy of the app
  // older than the data it finds stops saving and syncing until it is reloaded, so old code can't overwrite new data.
  var APP_VERSION = '2026.10.09', APP_BUILD = 2026100907;
  var outdated = false;
  var state = load();
  var prefs = loadPrefs();
  var ui = { tab: 'k401', sort: { key: 'ticker', dir: 1 }, savedAt: null, flash: {}, openYears: {} };
  var feedRun = { running: false, done: 0, total: 0, failed: 0 };

  function load() {
    try {
      var raw = localStorage.getItem(KEY);
      if (raw) { var d = normalize(JSON.parse(raw)); if (newerBuild(d)) outdated = true; return d; }
      var old = localStorage.getItem(OLD_KEY);
      if (old) { var s = normalize(JSON.parse(old)); s.meta.migrated = true; return s; }
    } catch (e) { /* fall through to sample data */ }
    return seed();
  }
  function loadPrefs() {
    var p = { keys: {}, theme: 'system' };
    try { Object.assign(p, JSON.parse(localStorage.getItem(PREFS_KEY) || '{}')); } catch (e) { /* defaults */ }
    p.keys = p.keys || {};
    return p;
  }
  function savePrefs() { try { localStorage.setItem(PREFS_KEY, JSON.stringify(prefs)); } catch (e) { toast('Could not save that setting in this browser.'); } }
  // auto = a save the app makes on its own (daily snapshot, price refresh). Only your own edits move editedAt,
  // and editedAt is what decides which copy is newer when syncing, so an automatic save never makes stale data win.
  function newerBuild(s) { return n(s && s.meta && s.meta.appBuild) > APP_BUILD; }
  function save(auto) {
    clearTimeout(saveTimer);
    ui.saveQueued = false;
    // Sample view: changes stay on screen only. Your own data on the device and in OneDrive is left as it is.
    if (ui.demo) { ui.userPending = false; paintSaveStatus(); return; }
    // An out-of-date copy of the app undoes the change instead of saving it, and says why.
    if (outdated) {
      if (!auto || ui.userPending) {
        try { var raw = localStorage.getItem(KEY); if (raw) state = normalize(JSON.parse(raw)); } catch (e) { /* keep what is shown */ }
        toast('Reload to update the app first. That change was not saved.');
        render();
      }
      ui.userPending = false;
      return;
    }
    state.meta.appBuild = APP_BUILD;
    // Data saved before editedAt existed: its last save time is the best record of the last edit, so keep it.
    if (state.meta.editedAt == null) state.meta.editedAt = n(state.meta.savedAt);
    recordSnapshot();
    state.meta.savedAt = Date.now();
    if (!auto || ui.userPending) { state.meta.editedAt = state.meta.savedAt; ui.userPending = false; }
    try { localStorage.setItem(KEY, JSON.stringify(state)); ui.savedAt = Date.now(); }
    catch (e) { toast('Could not save on this device. Use Export to keep a copy.'); }
    cloudSaveSoon();
    paintSaveStatus();
  }
  var saveTimer;

  /* Backups on this device: a copy of your data (without net worth history, which is never lost in a sync) is kept
     once a day and before anything replaces it, such as loading another device's copy, importing or restoring. */
  var BACKUP_KEY = 'portfolio-studio-backups', BACKUP_KEEP = 20;
  function loadBackups() { try { var b = JSON.parse(localStorage.getItem(BACKUP_KEY) || '[]'); return Array.isArray(b) ? b : []; } catch (e) { return []; } }
  // What the backup holds: items and settings, not prices' timestamps or save times, so identical data isn't kept twice.
  function dataSig(s) { return JSON.stringify([ORDER.map(function (k) { return s[k]; }), s.settings]); }
  function itemSummary(s) {
    var parts = [[s.stocks.length, 'holding'], [s.k401.length, '401(k)', '401(k)s'], [s.cds.length, 'CD'], [s.cash.length, 'savings account'], [s.assets.length, 'asset'], [s.mortgage.length, 'loan']];
    return parts.filter(function (p) { return p[0]; }).map(function (p) { return p[0] + ' ' + (p[0] === 1 ? p[1] : p[2] || p[1] + 's'); }).join(' · ') || 'No items';
  }
  function backupNow(reason, s) {
    s = s || state;
    if (!hasData(s)) return;
    var list = loadBackups(), sig = dataSig(s);
    if (list[0] && list[0].sig === sig) return;
    list.unshift({ at: Date.now(), reason: reason, sum: itemSummary(s), sig: sig, data: JSON.stringify(Object.assign({}, s, { history: [] })) });
    list = list.slice(0, BACKUP_KEEP);
    // If the browser runs out of room, drop the oldest backups until the new one fits.
    while (list.length) {
      try { localStorage.setItem(BACKUP_KEY, JSON.stringify(list)); return; } catch (e) { if (list.length === 1) return; list.pop(); }
    }
  }
  function dailyBackup() {
    var list = loadBackups();
    if (!list.some(function (b) { return new Date(b.at).toDateString() === new Date().toDateString(); })) backupNow('Daily backup');
  }
  // Puts a backup back. History stays as it is now, and the restore counts as your edit, so it syncs to every device.
  function restoreData(data, label) {
    backupNow('Before restoring ' + label);
    var hist = state.history;
    state = normalize(data); state.meta.sample = false; state.meta.migrated = false;
    state.history = mergeHistory(hist, state.history);
    save(); render(); toast('Restored ' + label);
  }

  /* Sample view: shows made-up data in place of yours, for trying things out or showing the app to someone.
     Only what's on screen changes. Nothing is saved or synced while it's on, and a reload always opens your own data. */
  function showSample(on) {
    if (!!ui.demo === on) return;
    if (on && syncing) { toast('Syncing with OneDrive. Try again in a moment.'); return; }
    if (on) {
      if (ui.saveQueued) save(true);
      ui.demo = true;
      var feed = state.feed;
      state = seed(); state.feed = Object.assign({}, feed, { autoMins: 0 });
    } else {
      ui.demo = false;
      state = load();
      cloudSync();
    }
    render();
    toast(on ? 'Showing sample data. Your own data is untouched.' : 'Back to your data');
  }

  /* Automatic daily snapshots. Today's entry is created on the first save of the day and then kept up to date,
     so it ends the day holding the last numbers. Skipped for sample data. When prices refresh automatically
     during market hours, the day's first entry waits for the first refresh so it isn't recorded at yesterday's prices. */
  function waitingForPrices() {
    var f = state.feed;
    if (!feedKey() || !n(f.autoMins) || !state.stocks.some(function (r) { return !r.manual; })) return false;
    if (feedRun.running) return true;
    if (f.marketHoursOnly && !marketOpen()) return false;
    return !(f.lastRun && new Date(f.lastRun).toDateString() === new Date().toDateString());
  }
  // With OneDrive sync on, automatic saves wait until the first download after opening has finished.
  function gateOpen() { return !outdated && !ui.demo && (!prefs.cloud || !cloudAvailable() || cloud.firstDone); }
  function openGate() {
    if (cloud.firstDone) return;
    cloud.firstDone = true;
    setTimeout(fetchLogos, 4000);
    if (snapDue()) { save(true); softRender(); }
    setTimeout(autoTick, 500);
  }
  function canSnap() { return gateOpen() && state.settings.autoSnap && !state.meta.sample && ORDER.some(function (k) { return state[k].length; }); }
  function recordSnapshot() {
    if (!canSnap()) return;
    var d = today(), i = state.history.map(function (e) { return e.date; }).indexOf(d);
    if (i < 0 && waitingForPrices()) return;
    var e = snapEntry(state, d);
    if (i >= 0) { e.manual = !!state.history[i].manual; state.history[i] = e; } else state.history.push(e);
  }
  function snapDue() {
    return canSnap() && !state.history.some(function (e) { return e.date === today(); }) && !waitingForPrices();
  }
  function saveSoon(auto) { if (!auto) ui.userPending = true; ui.saveQueued = true; clearTimeout(saveTimer); saveTimer = setTimeout(function () { save(true); }, 400); }
  var toastTimer;
  function toast(msg) {
    var el = $('#toast');
    el.textContent = msg; el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.classList.remove('show'); }, 3600);
  }
  function applyTheme() {
    if (prefs.theme === 'light' || prefs.theme === 'dark') document.documentElement.setAttribute('data-theme', prefs.theme);
    else document.documentElement.removeAttribute('data-theme');
  }
  applyTheme();

  /* App lock (per device): Face ID / Touch ID through a passkey made only for unlocking this app. Turned on and off in
     Settings. While locked nothing of yours is drawn; sync and price refreshes carry on in the background. This is a
     screen lock: the data on the device is not encrypted. The passkey is never sent anywhere, since there's no server. */
  var lockState = { locked: false, hiddenAt: 0, busy: false };
  function lockPrefs() { return prefs.lock && prefs.lock.on && prefs.lock.credId ? prefs.lock : null; }
  function lockAvailable() {
    if (!window.PublicKeyCredential || !navigator.credentials || !window.isSecureContext) return Promise.resolve(false);
    return PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable().catch(function () { return false; });
  }
  function rand(len) { var a = new Uint8Array(len); crypto.getRandomValues(a); return a; }
  function fromB64url(str) { str = str.replace(/-/g, '+').replace(/_/g, '/'); while (str.length % 4) str += '='; var b = atob(str), a = new Uint8Array(b.length); for (var i = 0; i < b.length; i++) a[i] = b.charCodeAt(i); return a; }
  function lockErr(e) {
    if (e && e.name === 'NotAllowedError') return 'Face ID / Touch ID was cancelled or timed out. Try again.';
    if (e && e.name === 'InvalidStateError') return 'This device already has a lock passkey for Portfolio Studio. Try again.';
    return 'Face ID / Touch ID isn’t available here' + (e && e.message ? ' (' + e.message + ')' : '') + '.';
  }
  // Asks for Face ID / Touch ID with this device's lock passkey. Resolves when the person is verified.
  function verifyLock() {
    var l = lockPrefs(); if (!l) return Promise.resolve();
    return navigator.credentials.get({ publicKey: {
      challenge: rand(32), rpId: location.hostname, timeout: 60000, userVerification: 'required',
      allowCredentials: [{ type: 'public-key', id: fromB64url(l.credId) }]
    } });
  }
  function enableLock() {
    lockAvailable().then(function (ok) {
      if (!ok) { toast('Face ID / Touch ID isn’t available in this browser.'); return; }
      return navigator.credentials.create({ publicKey: {
        rp: { name: 'Portfolio Studio', id: location.hostname },
        user: { id: rand(16), name: 'Portfolio Studio app lock', displayName: 'Portfolio Studio app lock' },
        challenge: rand(32), timeout: 60000, attestation: 'none',
        pubKeyCredParams: [{ type: 'public-key', alg: -7 }, { type: 'public-key', alg: -257 }],
        authenticatorSelection: { authenticatorAttachment: 'platform', userVerification: 'required', residentKey: 'discouraged' }
      } }).then(function (cred) {
        prefs.lock = { on: true, credId: b64url(new Uint8Array(cred.rawId)), after: prefs.lock && prefs.lock.after != null ? prefs.lock.after : 1, since: Date.now() };
        savePrefs(); render(); toast('App lock is on for this device');
      });
    }).catch(function (e) { toast(lockErr(e)); });
  }
  // Turning the lock off asks for Face ID / Touch ID first, so someone holding the open app can't quietly remove it.
  function disableLock() {
    verifyLock().then(function () {
      prefs.lock = { on: false, after: prefs.lock ? prefs.lock.after : 1 }; savePrefs(); render();
      toast('App lock is off for this device. You can delete the “Portfolio Studio app lock” passkey in your passwords settings.');
    }, function (e) { toast(lockErr(e)); });
  }
  function lockNow() {
    if (!lockPrefs() || lockState.locked) return;
    lockState.locked = true;
    try { if (dlg.open) dlg.close(); } catch (e) { /* not open */ }
    document.documentElement.classList.add('locked');
    render();
  }
  function unlock() {
    if (lockState.busy) return;
    lockState.busy = true; showLock();
    verifyLock().then(function () {
      lockState.locked = false; lockState.busy = false;
      document.documentElement.classList.remove('locked', 'veiled');
      $('#lock').hidden = true; $('#lock').innerHTML = '';
      render();
    }, function (e) { lockState.busy = false; showLock(lockErr(e)); });
  }
  function showLock(msg) {
    var el = $('#lock'); el.hidden = false;
    el.innerHTML = '<div class="lock-card" role="dialog" aria-modal="true" aria-labelledby="lockTitle"><span class="mark lock-mark"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M5 18V9m7 9V5m7 13v-6M3 18h18"/></svg></span>' +
      '<h2 id="lockTitle">Portfolio Studio is locked</h2><p>Unlock with Face ID, Touch ID or your device passcode.</p>' +
      (msg ? '<p class="lock-msg">' + esc(msg) + '</p>' : '') +
      '<button type="button" class="btn primary lock-btn" data-act="unlock"' + (lockState.busy ? ' disabled' : '') + '>' + (lockState.busy ? 'Waiting for Face ID…' : 'Unlock') + '</button>' +
      '<button type="button" class="lock-out" data-act="lock-signout">Can’t unlock? Sign out and remove data from this device</button></div>';
    var b = el.querySelector('.lock-btn'); if (b && !lockState.busy) b.focus();
  }
  // Auto-lock: the screen is veiled as soon as the app goes to the background (so the app switcher shows nothing),
  // and the app locks if it stays away for the chosen time.
  document.addEventListener('visibilitychange', function () {
    var l = lockPrefs(); if (!l) return;
    if (document.hidden) { lockState.hiddenAt = Date.now(); document.documentElement.classList.add('veiled'); if (!n(l.after)) lockNow(); }
    else {
      if (lockState.hiddenAt && Date.now() - lockState.hiddenAt >= n(l.after) * 60000) lockNow();
      if (!lockState.locked) document.documentElement.classList.remove('veiled');
    }
  });
  if (lockPrefs()) { lockState.locked = true; document.documentElement.classList.add('locked'); }

  /* ---------- OneDrive sync (Microsoft Graph, app folder only) ----------
     Sign-in uses the OAuth 2.0 authorization-code flow with PKCE for single-page apps, so there is no client secret.
     The page can only reach its own folder, OneDrive/Apps/<app name>/. The most recently edited copy wins, net worth
     history from every device is combined, and items that would be lost are asked about first. Each device also
     keeps a daily backup there, in backups/. Sign-in tokens and API keys stay on each device. */
  var CLOUD = {
    clientId: 'be35e1ab-34e9-4540-bbb0-d28a26f13dd9',
    authority: 'https://login.microsoftonline.com/consumers/oauth2/v2.0',
    graph: 'https://graph.microsoft.com/v1.0',
    scope: 'Files.ReadWrite.AppFolder User.Read offline_access',
    file: 'portfolio-data.json'
  };
  var AUTH_KEY = 'portfolio-studio-auth';
  // status: off | syncing | synced | offline | signin | error
  var cloud = { status: 'off', at: null, error: '', dirty: false, again: 0 };
  function looksValid(d) { return d && typeof d === 'object' && ORDER.some(function (k) { return Array.isArray(d[k]); }); }
  function cloudAvailable() { return /^https?:$/.test(location.protocol) && !!(window.crypto && crypto.subtle); }
  function redirectUri() { return location.origin + location.pathname.replace(/index\.html$/, ''); }
  function loadAuth() { try { return JSON.parse(localStorage.getItem(AUTH_KEY) || 'null'); } catch (e) { return null; } }
  function storeAuth(a) { try { if (a) localStorage.setItem(AUTH_KEY, JSON.stringify(a)); else localStorage.removeItem(AUTH_KEY); } catch (e) { /* private mode */ } }
  function b64url(bytes) { var s = ''; for (var i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]); return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); }
  function randomString(len) { var a = new Uint8Array(len); crypto.getRandomValues(a); return b64url(a); }
  function signinErr() { var e = new Error('Sign in to OneDrive again.'); e.signin = true; return e; }

  // Sends the page to Microsoft's sign-in. silent: only reuse an existing Microsoft session, never show a screen.
  function signIn(silent) {
    if (!cloudAvailable()) { toast('OneDrive sync works on the published page, not on a copy opened from disk.'); return; }
    var verifier = randomString(48), st = randomString(16);
    crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier)).then(function (hash) {
      try { sessionStorage.setItem('ps-pkce', JSON.stringify({ v: verifier, s: st, hash: location.hash, silent: !!silent })); } catch (e) { /* ignore */ }
      var a = loadAuth(), q = {
        client_id: CLOUD.clientId, response_type: 'code', redirect_uri: redirectUri(), scope: CLOUD.scope, response_mode: 'query',
        code_challenge: b64url(new Uint8Array(hash)), code_challenge_method: 'S256', state: st, prompt: silent ? 'none' : 'select_account'
      };
      if (a && a.user) q.login_hint = a.user;
      location.assign(CLOUD.authority + '/authorize?' + new URLSearchParams(q).toString());
    });
  }
  function tokenRequest(body) {
    return fetch(CLOUD.authority + '/token', {
      method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams(Object.assign({ client_id: CLOUD.clientId, scope: CLOUD.scope }, body)).toString()
    }).then(function (r) {
      return r.json().then(function (j) {
        if (!r.ok || !j.access_token) { var e = new Error(j.error_description ? j.error_description.split(/\r?\n/)[0] : (j.error || 'Sign-in failed')); e.code = j.error; throw e; }
        return j;
      });
    });
  }
  function keepTokens(j, prev) {
    var now = Date.now();
    var a = Object.assign({}, prev || {}, {
      access: j.access_token, accessExp: now + (n(j.expires_in) || 3600) * 1000,
      refresh: j.refresh_token || (prev && prev.refresh),
      // Refresh tokens for single-page apps last 24 hours from sign-in; renewing them keeps that end time.
      refreshExp: j.refresh_token_expires_in ? now + n(j.refresh_token_expires_in) * 1000 : ((prev && prev.refreshExp) || now + 24 * 3600 * 1000)
    });
    storeAuth(a);
    return a;
  }
  function accessToken() {
    var a = loadAuth();
    if (!a) return Promise.reject(signinErr());
    if (a.access && a.accessExp - 60000 > Date.now()) return Promise.resolve(a.access);
    if (a.refresh && a.refreshExp - 60000 > Date.now()) {
      return tokenRequest({ grant_type: 'refresh_token', refresh_token: a.refresh }).then(function (j) { return keepTokens(j, a).access; }, function (e) {
        if (e instanceof TypeError) throw e;
        throw signinErr();
      });
    }
    return Promise.reject(signinErr());
  }
  function graph(path, opts) {
    opts = opts || {};
    return accessToken().then(function (tok) {
      return fetch(CLOUD.graph + path, { method: opts.method || 'GET', headers: Object.assign({ Authorization: 'Bearer ' + tok }, opts.headers || {}), body: opts.body, cache: 'no-store' });
    }).then(function (r) {
      if (r.status === 401) throw signinErr();
      if (opts.raw) return r;
      if (!r.ok) { var e = new Error('OneDrive error (' + r.status + ')'); e.status = r.status; throw e; }
      return r.status === 204 ? null : r.json();
    });
  }
  // Finishes a sign-in that just came back from Microsoft. Runs once when the page loads.
  function handleRedirect() {
    var p = new URLSearchParams(location.search);
    if (!p.has('code') && !p.has('error')) return Promise.resolve(false);
    var saved = null;
    try { saved = JSON.parse(sessionStorage.getItem('ps-pkce') || 'null'); sessionStorage.removeItem('ps-pkce'); } catch (e) { /* ignore */ }
    history.replaceState(null, '', location.pathname + ((saved && saved.hash) || ''));
    if (!saved || p.get('state') !== saved.s) { toast('Sign-in could not be completed. Please try again.'); return Promise.resolve(false); }
    if (p.has('error')) {
      if (saved.silent) cloud.status = 'signin';
      else toast('Sign-in was not completed: ' + String(p.get('error_description') || p.get('error')).split(/\r?\n/)[0]);
      return Promise.resolve(false);
    }
    return tokenRequest({ grant_type: 'authorization_code', code: p.get('code'), redirect_uri: redirectUri(), code_verifier: saved.v }).then(function (j) {
      var a = keepTokens(j, loadAuth());
      var first = !prefs.cloud;
      prefs.cloud = true; savePrefs();
      return graph('/me').then(function (me) { a.user = me.userPrincipalName || me.mail || a.user || ''; a.name = me.displayName || a.name || ''; storeAuth(a); }, function () { /* name is optional */ })
        .then(function () { if (first) toast('Signed in. Syncing with OneDrive…'); return true; });
    }, function (e) { toast('Sign-in failed: ' + e.message); return false; });
  }

  function itemPath() { return '/me/drive/special/approot:/' + encodeURIComponent(prefs.cloudFile || CLOUD.file); }
  // When the copy was last edited by you. Data saved before editedAt existed falls back to its last save time.
  function editedAt(s) { var m = s && s.meta || {}; return n(m.editedAt != null ? m.editedAt : m.savedAt); }
  function hasData(s) { return !s.meta.sample && ORDER.some(function (k) { return s[k].length; }); }
  // Reads the data file from the app folder. If portfolio-data.json isn't there but exactly one .json file is, that file is used.
  function pullRemote() {
    return graph(itemPath(), { raw: true }).then(function (r) {
      if (r.status === 404) {
        return graph('/me/drive/special/approot/children').then(function (j) {
          var js = (j && j.value || []).filter(function (f) { return f.file && /\.json$/i.test(f.name); });
          if (js.length !== 1) return null;
          prefs.cloudFile = js[0].name; savePrefs();
          return js[0];
        });
      }
      if (!r.ok) { var e = new Error('OneDrive error (' + r.status + ')'); e.status = r.status; throw e; }
      return r.json();
    }).then(function (item) {
      if (!item || !item['@microsoft.graph.downloadUrl']) return item ? { item: item, data: null } : null;
      return fetch(item['@microsoft.graph.downloadUrl'], { cache: 'no-store' }).then(function (r) { return r.text(); }).then(function (t) {
        var data = null; try { data = JSON.parse(t); } catch (e) { /* not JSON */ }
        return { item: item, data: data, text: t };
      });
    });
  }
  function pushRemote() {
    if (outdated) return Promise.reject(outdatedErr());
    if (ui.demo) { var d = new Error('Sample data is showing'); d.demo = true; return Promise.reject(d); }
    var headers = { 'Content-Type': 'application/json' };
    if (prefs.cloudETag) headers['If-Match'] = prefs.cloudETag;
    return graph(itemPath() + ':/content', { method: 'PUT', headers: headers, body: JSON.stringify(state, null, 2), raw: true }).then(function (r) {
      if (r.status === 412) { var c = new Error('Changed on another device'); c.conflict = true; throw c; }
      if (!r.ok) { var e = new Error('OneDrive error (' + r.status + ')'); e.status = r.status; throw e; }
      return r.json();
    }).then(function (item) { prefs.cloudETag = item.eTag; prefs.cloudBase = itemIds(state); savePrefs(); cloud.dirty = false; });
  }
  function outdatedErr() { var e = new Error('A newer version of the app saved this data.'); e.outdated = true; return e; }
  // The ids of every item in a copy. cloudBase holds the ids in the last copy this device and OneDrive agreed on.
  function itemIds(s) { var out = []; ORDER.forEach(function (k) { (s[k] || []).forEach(function (r) { if (r && r.id) out.push(r.id); }); }); return out; }
  // Items in copy a that copy b doesn't have and that weren't in the last synced copy either: they were added
  // somewhere and haven't reached the other copy yet. Items in the last synced copy were deleted on purpose.
  function unsyncedItems(a, b) {
    if (!prefs.cloudBase) return [];
    var inB = {}, base = {};
    itemIds(b).forEach(function (id) { inB[id] = 1; });
    prefs.cloudBase.forEach(function (id) { base[id] = 1; });
    var out = [];
    ORDER.forEach(function (k) { (a[k] || []).forEach(function (r) { if (r && r.id && !inB[r.id] && !base[r.id]) out.push({ cat: k, rec: r }); }); });
    return out;
  }
  function itemName(x) { var r = x.rec; return CATS[x.cat].label + ': ' + (x.cat === 'stocks' ? r.ticker + (r.company ? ' (' + r.company + ')' : '') : r.name || 'Unnamed'); }
  function addItems(s, list) { list.forEach(function (x) { s[x.cat].push(x.rec); }); }
  function askKeep(list, adopting) {
    var names = list.map(function (x) { return '• ' + itemName(x); }).join('\n');
    return confirm(adopting
      ? 'OneDrive has a newer copy from another device, but it is missing ' + (list.length === 1 ? 'this item' : 'these ' + list.length + ' items') + ' from this device:\n\n' + names + '\n\nOK keeps ' + (list.length === 1 ? 'it' : 'them') + ' and adds ' + (list.length === 1 ? 'it' : 'them') + ' to the newer copy. Cancel removes ' + (list.length === 1 ? 'it' : 'them') + ' (a backup is kept in Settings).'
      : 'OneDrive has ' + (list.length === 1 ? 'an item' : list.length + ' items') + ' this device has never seen, probably added on another device:\n\n' + names + '\n\nOK keeps ' + (list.length === 1 ? 'it' : 'them') + '. Cancel removes ' + (list.length === 1 ? 'it' : 'them') + ' everywhere (a backup is kept in Settings).');
  }

  /* Daily OneDrive backup: the first sync of the day on each device saves the OneDrive copy as it was before anything
     changed it, to Apps/Portfolio Studio/backups/. The newest CLOUD_KEEP backups are kept. Best effort: a failure
     never stops a sync. */
  var CLOUD_KEEP = 40;
  function backupsPath() { return '/me/drive/special/approot:/backups'; }
  function cloudBackup(text) {
    if (prefs.cloudBackupDay === today() || !text || cloud.backingUp) return;
    cloud.backingUp = true;
    var d = new Date(), name = 'portfolio-data-' + today() + '-' + String(d.getHours()).padStart(2, '0') + String(d.getMinutes()).padStart(2, '0') + '.json';
    var put = function () { return graph(backupsPath() + '/' + encodeURIComponent(name) + ':/content', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: text }); };
    put().catch(function (e) {
      if (e && e.signin) throw e;
      // The backups folder doesn't exist yet: create it and try once more.
      return graph('/me/drive/special/approot/children', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: 'backups', folder: {}, '@microsoft.graph.conflictBehavior': 'fail' }) })
        .catch(function () { /* already there */ }).then(put);
    }).then(function () {
      prefs.cloudBackupDay = today(); savePrefs();
      return listCloudBackups().then(function (files) {
        return Promise.all(files.slice(CLOUD_KEEP).map(function (f) { return graph('/me/drive/items/' + encodeURIComponent(f.id), { method: 'DELETE' }); }));
      });
    }).catch(function () { /* try again next sync */ }).then(function () { cloud.backingUp = false; });
  }
  // Newest first.
  function listCloudBackups() {
    return graph(backupsPath() + ':/children?$top=200').then(function (j) {
      return (j && j.value || []).filter(function (f) { return f.file && /^portfolio-data-.*\.json$/.test(f.name); })
        .sort(function (a, b) { return a.name < b.name ? 1 : -1; });
    });
  }
  // Keeps the other copy's data as is (no new save time) but adds this device's snapshot days.
  function adoptRemote(r) {
    var localHist = state.history;
    state = normalize(r); state.meta.sample = false; state.meta.migrated = false;
    state.history = mergeHistory(state.history, localHist);
    prefs.cloudBase = itemIds(state); savePrefs();
    try { localStorage.setItem(KEY, JSON.stringify(state)); ui.savedAt = Date.now(); } catch (e) { /* ignore */ }
  }
  var syncing = null, cloudTimer;
  // Full sync: download, keep whichever copy was edited last, combine history, upload if this device has anything new.
  function cloudSync() {
    if (!prefs.cloud || !cloudAvailable() || ui.demo) return Promise.resolve();
    if (outdated) { cloud.status = 'outdated'; openGate(); paintSaveStatus(); return Promise.resolve(); }
    if (syncing) { cloud.again = Math.max(cloud.again, 1); return syncing; }
    cloud.status = 'syncing'; paintSaveStatus();
    var adopted = false;
    syncing = pullRemote().then(function (remote) {
      cloud.missing = !remote;
      if (!remote || !looksValid(remote.data)) {
        if (remote && remote.data == null && remote.item) { cloud.error = 'The file in OneDrive is not Portfolio Studio data.'; }
        prefs.cloudETag = remote && remote.item ? remote.item.eTag : null; savePrefs();
        return hasData(state) ? pushRemote() : null;
      }
      var r = remote.data;
      // Saved by a newer version of the app: change nothing here or in OneDrive until this copy is reloaded.
      if (newerBuild(r)) { outdated = true; throw outdatedErr(); }
      cloudBackup(remote.text);
      if (remote.item.eTag === prefs.cloudETag && !cloud.dirty) return null;
      prefs.cloudETag = remote.item.eTag; savePrefs();
      var rn = normalize(r), differs = dataSig(rn) !== dataSig(state);
      if (!hasData(state) || editedAt(r) > editedAt(state)) {
        var lost = hasData(state) ? unsyncedItems(state, rn) : [];
        if (differs) backupNow('This device’s copy, before loading a newer one from OneDrive');
        var before = (r.history || []).length;
        adoptRemote(r); adopted = true;
        cloud.dirty = false;
        if (lost.length && askKeep(lost, true)) {
          addItems(state, lost); state.meta.editedAt = state.meta.savedAt = Date.now();
          try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { /* ignore */ }
          return pushRemote();
        }
        return state.history.length !== before ? pushRemote() : null;
      }
      var extra = unsyncedItems(rn, state);
      if (differs && hasData(rn)) backupNow('OneDrive’s copy, before replacing it with this device’s', rn);
      if (extra.length && askKeep(extra, false)) { addItems(state, extra); state.meta.editedAt = Date.now(); adopted = true; }
      state.history = mergeHistory(state.history, r.history);
      try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { /* ignore */ }
      return pushRemote();
    }).then(function () {
      cloud.status = 'synced'; cloud.at = Date.now(); if (!/not Portfolio/.test(cloud.error)) cloud.error = '';
    }, function (e) {
      if (e && e.conflict) { cloud.again += 1; cloud.status = 'syncing'; }
      else if (e && e.outdated) cloud.status = 'outdated';
      else if (e && e.signin) cloud.status = 'signin';
      else if (e instanceof TypeError || navigator.onLine === false) cloud.status = 'offline';
      else { cloud.status = 'error'; cloud.error = (e && e.message) || 'Unknown error'; }
    }).then(function () {
      syncing = null;
      openGate();
      paintSaveStatus();
      if (adopted) softRender(); else if (cloud.status !== 'synced' || currentView() === 'settings') softRender();
      if (outdated) { cloud.again = 0; return; }
      if (cloud.again && cloud.again < 3) { cloud.again += 1; return cloudSync(); }
      cloud.again = 0;
    });
    return syncing;
  }
  // After a change: upload in about 2 seconds. If OneDrive changed in the meantime, fall back to a full sync.
  function cloudSaveSoon() {
    if (!prefs.cloud || !cloudAvailable() || ui.demo) return;
    cloud.dirty = true;
    clearTimeout(cloudTimer);
    cloudTimer = setTimeout(function () {
      // Showing sample data: the change stays marked as not uploaded and goes up when you switch back.
      if (ui.demo) return;
      if (syncing || !prefs.cloudETag) { cloudSync(); return; }
      cloud.status = 'syncing'; paintSaveStatus();
      pushRemote().then(function () { cloud.status = 'synced'; cloud.at = Date.now(); paintSaveStatus(); }, function () { if (!outdated) cloudSync(); });
    }, 2000);
  }
  function initCloud() {
    if (!cloudAvailable()) { openGate(); return; }
    handleRedirect().then(function (justSignedIn) {
      if (!prefs.cloud) { openGate(); softRender(); return; }
      var a = loadAuth(), expired = !a || !(a.refreshExp - 60000 > Date.now());
      var tried = false; try { tried = sessionStorage.getItem('ps-silent') === '1'; } catch (e) { /* ignore */ }
      // A day after sign-in the refresh token ends; quietly reuse the Microsoft session once per visit.
      if (!justSignedIn && expired && cloud.status !== 'signin' && !tried && navigator.onLine !== false) {
        try { sessionStorage.setItem('ps-silent', '1'); } catch (e) { /* ignore */ }
        signIn(true); return;
      }
      if (expired && !justSignedIn) { cloud.status = 'signin'; openGate(); paintSaveStatus(); softRender(); return; }
      try { sessionStorage.removeItem('ps-silent'); } catch (e) { /* ignore */ }
      return cloudSync();
    });
    document.addEventListener('visibilitychange', function () { if (!document.hidden) cloudSync(); });
    window.addEventListener('online', function () { cloudSync(); });
    setInterval(function () { if (!document.hidden) cloudSync(); }, 5 * 60000);
  }
  var cloudActs = {
    'cloud-signin': function () { try { sessionStorage.removeItem('ps-silent'); } catch (e) { /* ignore */ } signIn(false); },
    'cloud-sync': function () { cloudSync().then(function () { if (cloud.status === 'synced') toast('Synced with OneDrive'); }); },
    // Signing out uploads anything not yet in OneDrive, then removes your data from this device.
    'cloud-signout': function () {
      if (!confirm('Sign out on this device?\n\nYour latest changes are uploaded to OneDrive first. Then your accounts, net worth history and backups are removed from this device, and it shows sample data. Signing in again brings everything back. Price-feed keys stay.')) return;
      if (ui.saveQueued) save(true);
      clearTimeout(cloudTimer);
      var mine = hasData(state);
      if (mine) toast('Uploading your latest changes…');
      (mine ? cloudSync() : Promise.resolve()).then(function () {
        if (mine && (cloud.status !== 'synced' || cloud.dirty) &&
          !confirm('Could not finish syncing with OneDrive (' + saveText() + ').\n\nChanges made on this device since its last sync are not in OneDrive and would be lost. Sign out and remove the data from this device anyway?')) return;
        signOutHere();
      });
    }
  };
  function signOutHere() {
    clearTimeout(saveTimer); clearTimeout(cloudTimer);
    prefs.cloud = false; prefs.cloudETag = null; prefs.cloudBase = null; prefs.cloudBackupDay = null; prefs.cloudFile = null; savePrefs(); storeAuth(null);
    // Nothing of yours is left to protect, so the app lock goes too.
    if (prefs.lock && prefs.lock.on) { prefs.lock = { on: false, after: prefs.lock.after }; savePrefs(); }
    try { [KEY, OLD_KEY, BACKUP_KEY].forEach(function (k) { localStorage.removeItem(k); }); sessionStorage.removeItem('ps-silent'); } catch (e) { /* private mode */ }
    cloud = { status: 'off', at: null, error: '', dirty: false, again: 0 };
    var feed = state.feed;
    state = seed(); state.feed = feed;
    outdated = false; ui.savedAt = null; ui.userPending = false; ui.saveQueued = false; ui.cloudBackups = null;
    render(); toast('Signed out. Your data was removed from this device and is safe in OneDrive.');
  }

  /* ---------- live prices ---------- */
  function feedKey() { return (prefs.keys[state.feed.provider] || '').trim(); }
  // The other provider, tried for any symbol the main one can't price when you have saved a key for it.
  function altProvider() { return Object.keys(FEEDS).filter(function (k) { return k !== state.feed.provider; })[0]; }
  function altKey() { return (prefs.keys[altProvider()] || '').trim(); }
  function findStock(id) { return state.stocks.filter(function (r) { return r.id === id; })[0]; }
  function refreshPrices(manual) {
    if (feedRun.running) { if (manual) toast('Prices are already refreshing.'); return; }
    var prov = FEEDS[state.feed.provider] || FEEDS.finnhub, key = feedKey();
    if (!key) {
      if (manual) { toast('Add a free price-feed API key in Settings first.'); location.hash = '#/settings'; }
      return;
    }
    var list = state.stocks.filter(function (r) { return !r.manual && (r.symbol || r.ticker); });
    if (!list.length) { if (manual) toast('Nothing to refresh. Holdings marked Manual are skipped.'); return; }
    // Market symbols for the ticker, unless you already hold them (then the holding's price is used).
    if (state.settings.tickerMarket) MARKET.forEach(function (m) {
      if (!list.some(function (r) { return String(r.symbol || r.ticker).toUpperCase() === m[0]; })) list.push({ id: 'mkt:' + m[0], ticker: m[0], market: true });
    });
    feedRun = { running: true, done: 0, total: list.length, failed: 0, fatal: '' };
    state.feed.lastRun = Date.now();
    paintLive(); softRender();
    var i = 0, alt = FEEDS[altProvider()], akey = altKey(), retry = [], j = 0;
    function apply(r, q, p) {
      if (r.market) { state.market[r.ticker] = { price: Math.round(q.price * 10000) / 10000, prevClose: q.prevClose, quoteTime: Date.now(), quoteSource: p.label }; return; }
      var rec = findStock(r.id);
      if (!rec) return;
      if (n(rec.price) !== q.price) ui.flash[rec.id] = true;
      rec.price = Math.round(q.price * 10000) / 10000; rec.prevClose = q.prevClose;
      rec.quoteTime = Date.now(); rec.quoteSource = p.label; rec.quoteError = null;
    }
    function fail(r, msg) {
      if (r.market) state.market[r.ticker] = Object.assign({}, state.market[r.ticker], { quoteError: msg });
      else { var rec = findStock(r.id); if (rec) rec.quoteError = msg; }
      feedRun.failed++;
    }
    function sym(r) { return String(r.symbol || r.ticker).trim().toUpperCase(); }
    function next() {
      var r = list[i++];
      prov.quote(sym(r), key).then(function (q) { apply(r, q, prov); }, function (err) {
        if (err.fatal) { fail(r, err.message); feedRun.fatal = err.message; }
        // No quote for this symbol (for example a mutual fund on Finnhub's free plan): try the other provider afterwards.
        else if (alt && akey) retry.push({ r: r, err: err.message });
        else fail(r, err.message);
      }).then(function () {
        feedRun.done++;
        saveSoon(true); paintLive(); softRender();
        if (i < list.length && !feedRun.fatal) setTimeout(next, prov.gap);
        else if (retry.length) { feedRun.total += retry.length; feedRun.backup = alt.label; paintLive(); setTimeout(nextAlt, 300); }
        else finish();
      });
    }
    // Backup provider, one symbol at a time at its own pace. A rejected key or used-up allowance stops only the backup.
    function nextAlt() {
      var x = retry[j++], r = x.r;
      alt.quote(sym(r), akey).then(function (q) { apply(r, q, alt); }, function (err) {
        fail(r, x.err + ' ' + alt.label + ': ' + err.message);
        if (err.fatal) { retry.slice(j).forEach(function (y) { fail(y.r, y.err); feedRun.done++; }); j = retry.length; }
      }).then(function () {
        feedRun.done++;
        saveSoon(true); paintLive(); softRender();
        if (j < retry.length) setTimeout(nextAlt, alt.gap); else finish();
      });
    }
    function finish() {
      feedRun.running = false;
      setTimeout(fetchLogos, 1500);
      state.feed.lastRun = Date.now();
      save(true); paintLive(); softRender();
      var ok = feedRun.done - feedRun.failed;
      if (feedRun.fatal) toast('Stopped after ' + ok + ' of ' + feedRun.total + ': ' + feedRun.fatal);
      else if (manual || feedRun.failed) toast('Updated ' + ok + ' of ' + feedRun.total + ' prices' + (feedRun.failed ? ' · ' + feedRun.failed + ' could not be priced' : ''));
    }
    next();
  }
  function autoTick() {
    var f = state.feed;
    if (!f.autoMins || feedRun.running || !feedKey() || document.hidden || !gateOpen()) return;
    // One refresh after each close (any time after 4:05 PM New York, or the next time the app opens) for closing prices.
    if (n(f.lastRun) < lastClose()) { refreshPrices(false); return; }
    if (f.marketHoursOnly && !marketOpen()) return;
    if (Date.now() - n(f.lastRun) < f.autoMins * 60000) return;
    refreshPrices(false);
  }
  function feedStatus() {
    if (feedRun.running) return { cls: 'busy', text: 'Refreshing prices · ' + feedRun.done + ' of ' + feedRun.total + (feedRun.backup ? ' · trying ' + feedRun.backup : '') };
    var prov = FEEDS[state.feed.provider] || FEEDS.finnhub;
    if (!feedKey()) return { cls: '', text: 'Live prices off · add a key in Settings' };
    var f = state.feed, closed = f.marketHoursOnly && !marketOpen();
    var auto = f.autoMins ? ' · auto every ' + autoLabel(f.autoMins) + (closed ? ' (market closed)' : '') : '';
    return { cls: f.autoMins && !closed ? 'live' : '', text: prov.label + (f.lastRun ? ' · refreshed ' + when(f.lastRun) : ' · not refreshed yet') + auto };
  }
  function autoLabel(m) { return m >= 60 ? (m / 60) + ' hr' : m + ' min'; }
  var AUTO_OPTS = [0, 1, 5, 15, 30, 60, 120, 240];
  function autoSelect(id) {
    return '<select class="mini" id="' + id + '" data-feed="autoMins" data-fk="' + id + '">' + AUTO_OPTS.map(function (m) {
      return '<option value="' + m + '"' + (n(state.feed.autoMins) === m ? ' selected' : '') + '>' + (m ? 'Every ' + autoLabel(m) : 'Off') + '</option>';
    }).join('') + '</select>';
  }
  function refreshBtn(primary) {
    var busy = feedRun.running;
    return '<button type="button" class="btn' + (primary ? ' primary' : '') + '" data-act="refresh"' + (busy ? ' disabled' : '') + ' data-fk="refresh-' + (primary ? 'p' : 's') + '">' +
      icon('refresh', busy ? 'spin' : '') + (busy ? 'Refreshing ' + feedRun.done + '/' + feedRun.total : 'Refresh prices') + '</button>';
  }

  /* ---------- rendering ---------- */
  var VIEWS = [['overview', 'Overview'], ['stocks', 'Stocks'], ['accounts', 'Accounts'], ['projections', 'Projections'], ['insights', 'Insights'], ['settings', 'Settings']];
  function currentView() {
    var h = (location.hash || '').replace(/^#\/?/, '');
    return VIEWS.some(function (v) { return v[0] === h; }) ? h : 'overview';
  }
  var lastView = null;
  function render() {
    // Locked: nothing of yours is drawn until Face ID / Touch ID unlocks the app.
    if (lockState.locked) { $('#main').innerHTML = ''; $('#sideFoot').innerHTML = ''; showLock(); return; }
    var view = currentView();
    var active = document.activeElement, fk = active && active.getAttribute && active.getAttribute('data-fk');
    var navHtml = function (cls) {
      return VIEWS.map(function (v) {
        return '<a href="#/' + v[0] + '"' + (v[0] === view ? ' aria-current="page"' : '') + '>' + icon(v[0]) + '<span>' + v[1] + '</span></a>';
      }).join('');
    };
    $('#nav').innerHTML = navHtml(); $('#mnav').innerHTML = navHtml();
    var body = { overview: renderOverview, stocks: renderStocks, accounts: renderAccounts, projections: renderProjections, insights: renderInsights, settings: renderSettings }[view]();
    $('#main').innerHTML = renderTopline() + renderBanners() + body;
    renderSideFoot();
    document.title = 'Portfolio Studio · ' + VIEWS.filter(function (v) { return v[0] === view; })[0][1];
    if (view !== lastView) { if (lastView !== null) window.scrollTo(0, 0); lastView = view; }
    else if (fk) { var el = document.querySelector('[data-fk="' + fk + '"]'); if (el) { el.focus({ preventScroll: true }); if (el.select && el.type !== 'range' && el.tagName === 'INPUT' && el.type !== 'checkbox') el.select(); } }
    ui.flash = {};
  }
  // Background updates (price feed, file sync) wait while someone is typing in a field, so their input is not wiped.
  var pending = false;
  function softRender() {
    var a = document.activeElement;
    if (a && /^(INPUT|SELECT|TEXTAREA)$/.test(a.tagName) && $('#main').contains(a)) { pending = true; return; }
    if (document.querySelector('dialog[open]')) { pending = true; return; }
    render();
  }
  document.addEventListener('focusout', function () { if (pending) setTimeout(function () { if (pending) { pending = false; softRender(); } }, 0); });
  // Short form for the phone toolbar, where auto-refresh has its own menu next to it.
  function feedShort() {
    if (feedRun.running) return 'Refreshing ' + feedRun.done + ' of ' + feedRun.total;
    if (!feedKey()) return 'Live prices off';
    var f = state.feed, prov = FEEDS[f.provider] || FEEDS.finnhub;
    return prov.label + (f.lastRun ? ' · ' + when(f.lastRun) : ' · not refreshed');
  }
  function paintLive() {
    var s = feedStatus();
    // Only the status classes change, so layout classes (phone-only, desk-only) stay put.
    var mark = function (el) { el.classList.remove('live', 'busy'); if (s.cls) el.classList.add(s.cls); };
    document.querySelectorAll('[data-feed-chip]').forEach(function (el) { mark(el); el.textContent = s.text; });
    document.querySelectorAll('[data-feed-short]').forEach(function (el) { mark(el); el.textContent = feedShort(); });
  }
  function saveText() {
    if (ui.demo) return 'Sample data · changes aren’t saved';
    if (outdated) return 'Paused · reload to update the app';
    if (prefs.cloud) {
      if (cloud.status === 'synced') return 'Synced to OneDrive · ' + when(cloud.at);
      if (cloud.status === 'syncing') return 'Syncing with OneDrive…';
      if (cloud.status === 'offline') return 'Offline · will sync to OneDrive';
      if (cloud.status === 'signin') return 'OneDrive: sign in again';
      if (cloud.status === 'error') return 'OneDrive sync error · saved on this device';
    }
    return ui.savedAt || state.meta.savedAt ? 'Saved on this device · ' + when(ui.savedAt || state.meta.savedAt) : 'Not saved yet';
  }
  function paintSaveStatus() { document.querySelectorAll('[data-save-status]').forEach(function (el) { el.textContent = saveText(); }); }

  function renderTopline() {
    var s = feedStatus();
    // Which data is on screen: green for yours, amber for the made-up sample (links to Settings, where you switch or sign in).
    var flag = state.meta.sample
      ? '<a class="flag sample" href="#/settings" title="Made-up data. Switch back or sign in to OneDrive under Settings."><b>Sample data</b><span class="flag-x"> · made up · not financial advice</span></a>'
      : '<div class="flag real"><b>Your data</b><span class="flag-x"> · not financial advice</span></div>';
    return '<div class="topline">' + flag +
      '<div class="actions"><button type="button" class="chip eye" data-act="hide-amounts" aria-pressed="' + hiding() + '" title="' + (hiding() ? 'Show amounts' : 'Hide amounts') + '" aria-label="' + (hiding() ? 'Show amounts' : 'Hide amounts') + '">' + icon(hiding() ? 'eyeOff' : 'eye') + '</button><span class="chip" data-save-status>' + esc(saveText()) + '</span><span class="chip ' + s.cls + '" data-feed-chip>' + esc(s.text) + '</span></div></div>';
  }
  function renderBanners() {
    var out = '';
    if (state.meta.migrated && !ui.demo) out += '<div class="banner"><p><strong>Brought over your data from Portfolio Manager.</strong> Everything you entered there is here. Nothing was changed in the old page.</p><button class="btn sm" data-act="dismiss-migrated">Got it</button></div>';
    if (outdated) out += '<div class="banner"><p><strong>A newer version of Portfolio Studio saved your data.</strong> This copy of the app is out of date, so it has paused saving and syncing to protect your data. Reload to update; nothing is lost.</p><button class="btn sm primary" data-act="reload">Reload</button></div>';
    if (prefs.cloud && cloud.status === 'signin') out += '<div class="banner"><p><strong>Sign in to OneDrive again.</strong> Your Microsoft sign-in has ended, so changes are saved on this device only until you sign in.</p><button class="btn sm primary" data-act="cloud-signin">Sign in</button></div>';
    if (prefs.cloud && cloud.status === 'error') out += '<div class="banner"><p><strong>Could not sync with OneDrive.</strong> ' + esc(cloud.error) + ' Changes are still saved on this device.</p><button class="btn sm" data-act="cloud-sync">Try again</button></div>';
    return out;
  }
  function renderSideFoot() {
    var t = totals(state);
    $('#sideFoot').innerHTML = '<div><div class="eyebrow">Coverage ratio</div><b>' + (t.liabilities ? (t.totalAssets / t.liabilities).toFixed(1) + '×' : 'No debt') + '</b><p>Total assets relative to what you owe.</p></div>' +
      '<div><div class="eyebrow">Saving</div><p data-save-status>' + esc(saveText()) + '</p><p class="muted">Version ' + APP_VERSION + '</p></div>';
  }

  /* ---------- overview ---------- */
  function catNote(k) {
    var t = totals(state), list = state[k];
    if (!list.length) return 'Nothing added yet';
    if (k === 'stocks') {
      var un = state.stocks.filter(function (r) { return !priced(r); }).length;
      return list.length + ' holdings · ' + signed(t.stockGain) + (t.stockCostPriced ? ' (' + sgnPct(t.stockGain / t.stockCostPriced * 100) + ')' : '') + ' vs. cost' + (un ? ' · ' + un + ' unpriced' : '');
    }
    if (k === 'k401') return money0(list.reduce(function (a, r) { return a + n(r.contrib); }, 0)) + ' added per year';
    if (k === 'cds') return list.length + ' certificates · ' + wavg(list, 'principal').toFixed(2) + '% average APY';
    if (k === 'cash') {
      var me = n(state.settings.monthlyExpenses);
      return wavg(list, 'balance').toFixed(2) + '% average APY' + (me ? ' · ' + (t.cash / me).toFixed(1) + ' months of spending' : '');
    }
    if (k === 'assets') return list.map(function (r) { return r.name; }).slice(0, 3).join(' + ') + ' · estimated';
    if (k === 'mortgage') {
      var left = function (r) { var m = payoffMonths(r); return m == null ? 'payment too low' : m === 0 ? 'paid off' : m < 12 ? m + ' mo left' : Math.floor(m / 12) + ' yr ' + (m % 12 ? (m % 12) + ' mo ' : '') + 'left'; };
      if (list.length > 2) { var soonest = list.slice().sort(function (a, b) { return n(payoffMonths(a)) - n(payoffMonths(b)); })[0]; return list.length + ' loans · next paid off: ' + soonest.name + ', ' + left(soonest); }
      return list.map(function (r) { return r.name + ' ' + left(r); }).join(' · ');
    }
    return '';
  }
  function upcoming() {
    var now = parseDate(today()), items = [];
    state.cds.forEach(function (r) {
      var d = parseDate(r.matures); if (!d) return;
      var days = daysUntil(r.matures), v = cdAtMaturity(r);
      items.push({ d: d, t: money0(v == null ? n(r.principal) : v) + (days < 0 ? ' CD matured' : ' CD matures'), s: r.name, act: cdActions(r) });
    });
    state.mortgage.forEach(function (r) {
      var m = payoffMonths(r); if (!m) return;
      var d = new Date(); d.setMonth(d.getMonth() + m);
      items.push({ d: d, t: esc(r.name) + ' paid off', s: 'At the current payment' });
    });
    return items.sort(function (a, b) { return a.d - b.d; }).slice(0, 4);
  }

  var RANGES = [['1m', '1M', 30], ['3m', '3M', 91], ['ytd', 'YTD', 0], ['1y', '1Y', 365], ['all', 'All', 0]];
  function rangeStart(r) {
    var d = new Date();
    if (r === 'ytd') return d.getFullYear() + '-01-01';
    var days = (RANGES.filter(function (x) { return x[0] === r; })[0] || [])[2];
    if (!days) return '0000';
    d.setDate(d.getDate() - days);
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }
  // Time-scaled line chart: gaps between snapshots show as real gaps.
  function lineChart(points, key) {
    var W = 900, H = 280, L = 64, R = 16, T = 20, B = 36;
    var vals = points.map(function (p) { return p[key]; });
    var lo = Math.min.apply(null, vals), hi = Math.max.apply(null, vals);
    if (hi === lo) { hi += 1000; lo -= 1000; }
    var pad = (hi - lo) * 0.12; lo -= pad; hi += pad;
    var step = niceStep((hi - lo) / 3);
    var gmin = Math.floor(lo / step) * step, gmax = Math.ceil(hi / step) * step;
    var ts = points.map(function (p) { return parseDate(p.date).getTime(); }), t0 = ts[0], span = (ts[ts.length - 1] - t0) || 1;
    var X = function (tm) { return L + (tm - t0) / span * (W - L - R); };
    var Y = function (v) { return T + (gmax - v) / (gmax - gmin) * (H - T - B); };
    var out = '';
    for (var g = gmin; g <= gmax + 1e-6; g += step) {
      out += '<line class="grid" x1="' + L + '" x2="' + (W - R) + '" y1="' + Y(g).toFixed(1) + '" y2="' + Y(g).toFixed(1) + '"/><text class="ax" x="' + (L - 8) + '" y="' + (Y(g) + 4).toFixed(1) + '" text-anchor="end">' + short(g) + '</text>';
    }
    var line = points.map(function (p, i) { return (i ? 'L' : 'M') + X(ts[i]).toFixed(1) + ',' + Y(p[key]).toFixed(1); }).join(' ');
    out += '<path class="c-area" d="' + line + ' L' + X(ts[ts.length - 1]).toFixed(1) + ',' + (H - B) + ' L' + L + ',' + (H - B) + ' Z"/><path class="c-line" d="' + line + '"/>';
    var many = points.length > 60;
    points.forEach(function (p, i) {
      out += '<circle class="' + (many ? 'c-hit' : p.manual ? 'c-dot man' : 'c-dot') + '" cx="' + X(ts[i]).toFixed(1) + '" cy="' + Y(p[key]).toFixed(1) + '" r="' + (many ? 6 : 4.5) + '"><title>' + esc(fmtDate(p.date) + ' · ' + money0(p[key]) + (p.manual ? ' · saved by hand' : '')) + '</title></circle>';
    });
    var long = span / 864e5 > 300, ticks = points.length > 1 ? 5 : 1;
    for (var k = 0; k < ticks; k++) {
      var tm = t0 + (ticks === 1 ? 0 : span * k / (ticks - 1));
      out += '<text class="ax" x="' + X(tm).toFixed(1) + '" y="' + (H - 12) + '" text-anchor="' + (k === 0 ? 'start' : k === ticks - 1 ? 'end' : 'middle') + '">' + esc(new Date(tm).toLocaleDateString('en-US', long ? { month: 'short', year: '2-digit' } : { month: 'short', day: 'numeric' })) + '</text>';
    }
    return '<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Net worth snapshots over time" style="width:100%;height:auto;display:block">' + out + '</svg>';
  }
  function histSection(hist) {
    var st = state.settings, key = st.histAfterTax ? 'netAfter' : 'net', r = st.histRange || 'all';
    var start = rangeStart(r);
    var pts = hist.filter(function (e) { return e[key] != null && e.date >= start; });
    var rangeBtns = '<div class="seg seg-range" role="group" aria-label="Range">' + RANGES.map(function (x) { return '<button type="button" data-act="hist-range" data-val="' + x[0] + '" aria-pressed="' + (r === x[0]) + '">' + x[1] + '</button>'; }).join('') + '</div>';
    var taxBtns = '<div class="seg seg-range" role="group" aria-label="Tax">' + [['before', 'Before tax'], ['after', 'After tax']].map(function (x) { return '<button type="button" data-act="hist-tax" data-val="' + x[0] + '" aria-pressed="' + ((st.histAfterTax ? 'after' : 'before') === x[0]) + '">' + x[1] + '</button>'; }).join('') + '</div>';
    var body, sum = '';
    if (pts.length >= 2) {
      var a = pts[0], z = pts[pts.length - 1], dv = z[key] - a[key];
      sum = '<p class="hist-sum"><b class="' + (dv < 0 ? 'neg' : 'pos') + '">' + signed(dv) + (a[key] ? ' (' + sgnPct(dv / Math.abs(a[key]) * 100) + ')' : '') + '</b> from ' + esc(fmtDate(a.date)) + ' to ' + esc(fmtDate(z.date)) + ' · ' + pts.length + ' snapshots</p>';
      body = lineChart(pts, key);
    } else {
      var msg = state.meta.sample ? 'Daily snapshots start once you use your own data. Dismiss the sample banner or start fresh.'
        : !st.autoSnap ? 'Automatic snapshots are off. Turn them on in Settings, or save one by hand.'
        : hist.length < 2 ? 'Your net worth is saved once a day while you use this page. The line appears after the second day.'
        : 'Not enough snapshots in this range. Try a longer one.';
      body = '<div class="empty">' + msg + '</div>';
    }
    return '<section class="section"><div class="section-head"><h2>Net worth over time</h2><div class="actions">' + rangeBtns + taxBtns + '<button class="btn" data-act="snapshot">Save snapshot now</button></div></div>' +
      '<div class="card chart-card">' + sum + body + '</div></section>';
  }
  function renderOverview() {
    var t = totals(state), st = state.settings;
    var hist = state.history.slice().sort(function (a, b) { return a.date < b.date ? -1 : 1; });
    // Compare with the snapshot from 30 days ago, or the earliest one if history is shorter.
    var trend = '<div class="trend"><span>' + (hist.length ? 'Tracking started today' : 'Daily snapshots start once you use your own data') + '</span></div>';
    var cutoff = new Date(); cutoff.setDate(cutoff.getDate() - 30);
    var cut = cutoff.getFullYear() + '-' + String(cutoff.getMonth() + 1).padStart(2, '0') + '-' + String(cutoff.getDate()).padStart(2, '0');
    var older = hist.filter(function (e) { return e.date < today(); });
    var base = older.filter(function (e) { return e.date <= cut; }).pop() || older[0];
    if (base) {
      var diff = t.net - base.net, is30 = base.date <= cut;
      trend = '<div class="trend' + (diff < 0 ? ' down' : '') + '">' + (diff < 0 ? '↘ ' : '↗ ') + signed(diff) + (base.net ? ' (' + sgnPct(diff / Math.abs(base.net) * 100) + ')' : '') + ' <span>' + (is30 ? 'vs 30 days ago' : 'since ' + esc(fmtDate(base.date))) + '</span></div>';
    }
    var tn = taxNow(state);
    var atLine = tn.total > 0.5 ? '<div class="at-line">' + money0(t.net - tn.total) + ' after estimated taxes<span>' + money0(tn.total) + ' would be due if you sold every stock and withdrew the 401(k) today</span></div>' : '';
    var A = t.totalAssets || 1;
    var parts = [['Investments', t.stocks + t.k401, 'var(--c-st)'], ['Property & assets', t.assets, 'var(--c-eq)'], ['Cash & CDs', t.cash + t.cds, 'var(--c-cc)']];
    var bar = parts.map(function (p) { return '<span style="width:' + (p[1] / A * 100).toFixed(2) + '%;background:' + p[2] + '"></span>'; }).join('');
    var legend = parts.map(function (p) { return '<span class="legend-item"><i class="dot" style="--c:' + p[2] + '"></i>' + p[0] + ' ' + pct(p[1] / A * 100) + '</span>'; }).join('');
    var barLabel = 'Assets: ' + parts.map(function (p) { return p[0] + ' ' + pct(p[1] / A * 100); }).join(', ');

    var maxCat = Math.max.apply(null, ORDER.map(function (k) { return t[k]; }).concat([1]));
    var colors = { stocks: 'var(--c-st)', k401: 'var(--c-k4)', cds: 'var(--c-cc)', cash: 'var(--c-sv)', assets: 'var(--c-eq)', mortgage: 'var(--neg)' };
    var rows = ORDER.map(function (k) {
      var href = k === 'stocks' ? '#/stocks' : '#/accounts', neg = k === 'mortgage';
      return '<a class="acct-row" href="' + href + '"' + (k === 'stocks' ? '' : ' data-act="goto-tab" data-cat="' + k + '"') + '><span class="glyph">' + icon(k === 'stocks' ? 'projections' : k) + '</span>' +
        '<span class="acct-name"><b>' + CATS[k].label + '</b><span>' + esc(catNote(k)) + '</span></span>' +
        '<span class="track"><i style="--w:' + (t[k] / maxCat * 100).toFixed(1) + '%;--c:' + colors[k] + '"></i></span>' +
        '<span class="acct-val' + (neg && t[k] ? ' neg' : '') + '">' + (neg && t[k] ? '−' : '') + money0(t[k]) + '</span></a>';
    }).join('');

    var me = n(st.monthlyExpenses), months = n(st.reserveMonths), target = me * months, extra = t.cash - target, nextMove;
    if (!me) nextMove = '<article class="card insight"><div class="eyebrow">Cash reserve</div><div class="metric">—</div><p>Add your monthly spending in Settings to see how much cash sits above your emergency reserve.</p><a class="btn" href="#/settings">Open settings</a></article>';
    else if (extra >= 0) nextMove = '<article class="card insight emph"><div class="eyebrow">Next move</div><div class="metric">' + money0(extra) + '</div><p>Savings and checking above your ' + months + '-month reserve of ' + money0(target) + '. This could go to investments or toward your loans.</p><a class="btn" href="#/projections">Test scenarios</a></article>';
    else nextMove = '<article class="card insight emph"><div class="eyebrow">Next move</div><div class="metric">' + money0(-extra) + '</div><p>Short of your ' + months + '-month reserve of ' + money0(target) + '. Topping up savings comes before investing more.</p><a class="btn" href="#/accounts" data-act="goto-tab" data-cat="cash">View savings</a></article>';
    var up = upcoming();
    var timeline = up.length ? '<div class="timeline">' + up.map(function (u) { return '<div class="tl"><b>' + u.t + '</b><span>' + esc(u.s) + ' · ' + u.d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }) + '</span>' + (u.act ? '<div class="tl-act">' + u.act + '</div>' : '') + '</div>'; }).join('') + '</div>' : '<p>No CD maturities or payoff dates yet.</p>';

    var chart = histSection(hist);
    var h1 = t.net <= 0 ? 'Building from the ground up.' : !me ? 'Everything you own and owe, in one place.' : extra >= 0 ? 'A strong base, with cash ready to work.' : 'A solid base. Next, rebuild the cash reserve.';

    return '<header class="head"><div><div class="eyebrow">Household position · ' + esc(new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })) + '</div><h1>' + h1 + '</h1></div>' +
      '<div class="actions">' + refreshBtn(false) + '<a class="btn primary" href="#/projections">Project forward</a></div></header>' +
      '<article class="ledger" aria-label="Net worth summary"><div><div class="eyebrow">Net worth</div><div class="big">' + money0(t.net) + '</div>' + trend + atLine + '</div>' +
      '<div class="ledger-right"><div class="bar-labels"><strong>' + money0(t.totalAssets) + ' assets</strong><span>− ' + money0(t.liabilities) + ' owed</span></div>' +
      '<div class="bal-bar" role="img" aria-label="' + esc(barLabel) + '">' + bar + '</div><div class="legend">' + legend + '</div></div></article>' +
      tickerTape() +
      '<section class="section"><div class="section-head"><h2>Accounts at a glance</h2><p>Every part of the balance sheet, grouped by the job it does. Select a row to edit it.</p></div>' +
      '<div class="acct-layout"><div class="card acct-list">' + rows + '</div><div class="stack">' + moversCard() + concCard() + goalMini() +
      '<article class="card insight"><h3>Coming up</h3>' + timeline + '</article>' + nextMove + '</div></div></section>' +
      chart;
  }

  /* ---------- stocks ---------- */
  function dayOf(r) {
    if (!priced(r) || r.prevClose == null || !(r.prevClose > 0)) return null;
    var c = n(r.price) - r.prevClose;
    return { chg: c, pct: c / r.prevClose * 100 };
  }
  var SORTS = {
    ticker: function (r) { return String(r.ticker).toUpperCase(); },
    company: function (r) { return String(r.company || '').toLowerCase(); },
    type: function (r) { return String(r.type || ''); },
    qty: function (r) { return n(r.qty); },
    cost: function (r) { return n(r.cost); },
    price: function (r) { return priced(r) ? n(r.price) : -Infinity; },
    day: function (r) { var d = dayOf(r); return d ? d.pct : -Infinity; },
    value: function (r) { return priced(r) ? n(r.qty) * n(r.price) : -Infinity; },
    gain: function (r) { return priced(r) ? n(r.qty) * (n(r.price) - n(r.cost)) : -Infinity; },
    gainPct: function (r) { return priced(r) && n(r.cost) ? (n(r.price) - n(r.cost)) / n(r.cost) : -Infinity; }
  };
  var HCOLS = [['ticker', 'Ticker'], ['company', 'Company'], ['type', 'Type'], ['qty', 'Qty', 1], ['cost', 'Cost / share', 1], ['price', 'Price', 1], ['day', 'Day', 1], ['value', 'Market value', 1], ['gain', 'Gain / loss', 1], ['gainPct', 'Gain %', 1]];
  /* Company logos: looked up once per ticker from Finnhub's company profile (with the Finnhub key), and only the
     image address is kept on the holding. Holdings without a logo (most ETFs and funds, private shares) get a
     monogram: the ticker's letters on a color picked from the ticker, so it's always the same. */
  var logoRun = false;
  function fetchLogos() {
    var key = (prefs.keys.finnhub || '').trim();
    if (!key || logoRun || ui.demo || outdated || state.meta.sample) return;
    // Also stocks looked up before industries were kept, so the industry check can use them.
    var todo = state.stocks.filter(function (r) { return (r.logoChecked == null || (r.type === 'Stock' && r.industry === undefined)) && r.type !== 'Private' && (r.symbol || r.ticker); });
    if (!todo.length) return;
    logoRun = true;
    var i = 0, changed = false;
    (function next() {
      var r = todo[i++];
      if (!r) { logoRun = false; if (changed) { save(true); softRender(); } return; }
      var sym = String(r.symbol || r.ticker).trim().toUpperCase();
      fetchJson('https://finnhub.io/api/v1/stock/profile2?symbol=' + encodeURIComponent(sym) + '&token=' + encodeURIComponent(key)).then(function (j) {
        var rec = findStock(r.id);
        if (rec) { rec.logo = j && /^https:\/\//.test(j.logo || '') ? j.logo : ''; rec.industry = j && typeof j.finnhubIndustry === 'string' ? j.finnhubIndustry.slice(0, 60) : ''; rec.logoChecked = Date.now(); changed = true; }
      }, function (err) {
        // Rate limit, bad key or no connection: stop and try again later. Anything else: no logo for this one.
        if (err.fatal) { i = todo.length; return; }
        var rec = findStock(r.id); if (rec) { rec.logo = ''; rec.industry = ''; rec.logoChecked = Date.now(); changed = true; }
      }).then(function () { setTimeout(next, 1100); });
    })();
  }
  // Logo images: shown once loaded; removed if they fail, so the monogram underneath shows. (Load and error events
  // don't bubble, so these listen in the capture phase.)
  document.addEventListener('load', function (e) { var t = e.target; if (t && t.tagName === 'IMG' && t.parentNode && t.parentNode.classList && t.parentNode.classList.contains('logo')) t.classList.add('ok'); }, true);
  document.addEventListener('error', function (e) { var t = e.target; if (t && t.tagName === 'IMG' && t.parentNode && t.parentNode.classList && t.parentNode.classList.contains('logo')) t.remove(); }, true);
  var MONO_COLORS = ['--c-eq', '--c-st', '--c-k4', '--c-cc', '--c-sv'];
  function logoHtml(r, cls) {
    var t = String(r.ticker || '?').toUpperCase().replace(/[^A-Z0-9]/g, '') || '?', h = 0;
    for (var i = 0; i < t.length; i++) h = (h * 31 + t.charCodeAt(i)) % 9973;
    var mono = t.slice(0, 5);
    // The monogram sits underneath; a logo that fails to load removes itself and the monogram shows.
    return '<span class="logo ' + (cls || '') + ' l' + mono.length + '" style="--c:var(' + MONO_COLORS[h % MONO_COLORS.length] + ')" aria-hidden="true">' + esc(mono) +
      (r.logo ? '<img src="' + esc(r.logo) + '" alt="" loading="lazy" referrerpolicy="no-referrer">' : '') + '</span>';
  }
  var PHONE_SORTS = [['value', -1, 'Value, highest first'], ['day', -1, 'Today, best first'], ['day', 1, 'Today, worst first'], ['gain', -1, 'Gain, highest first'], ['gainPct', -1, 'Gain %, highest first'], ['ticker', 1, 'Ticker, A to Z']];
  function holdingCard(r) {
    var p = priced(r), qty = n(r.qty), cost = qty * n(r.cost), mv = p ? qty * n(r.price) : null, g = p ? mv - cost : null, d = dayOf(r);
    var tag = r.manual ? '<span class="tag">Manual</span>' : r.quoteError ? '<span class="tag warn">Not updated</span>' : '';
    var cls = function (v) { return v < 0 ? 'neg' : 'pos'; };
    return '<button type="button" class="hc' + (ui.flash[r.id] ? ' flash' : '') + '" data-act="edit" data-cat="stocks" data-id="' + esc(r.id) + '" aria-label="Edit ' + esc(r.ticker) + '">' + logoHtml(r) +
      '<span class="hc-main">' +
      '<span class="hc-row"><span class="hc-tk">' + esc(r.ticker) + tag + '</span><b class="hc-val">' + (p ? money2(mv) : 'No price') + '</b></span>' +
      '<span class="hc-row"><span class="hc-co">' + esc(r.company || r.type || '') + '</span>' + (d ? '<span class="' + cls(d.chg) + '">' + (d.chg < 0 ? '▼ ' : '▲ ') + sgnPct(d.pct) + ' today</span>' : '<span class="muted">—</span>') + '</span>' +
      '<span class="hc-row hc-sub"><span>' + qtyTxt(qty) + ' sh · ' + (p ? px(n(r.price)) : 'cost ' + money2(n(r.cost))) + '</span>' +
      (p ? '<span class="' + cls(g) + '">' + signed(g) + (cost ? ' · ' + sgnPct(g / cost * 100) : '') + '</span>' : '<span class="muted">—</span>') + '</span>' +
      '</span></button>';
  }
  /* Split of market value by holding type, under the Holdings heading: stocks, ETFs, mutual funds, then everything else
     (bonds, other, and priced private holdings) as Other. Holdings with no price have no value and are left out. */
  var SPLIT = [['Stock', 'Stocks', 'var(--c-st)'], ['ETF', 'ETFs', 'var(--c-eq)'], ['Mutual Fund', 'Mutual funds', 'var(--c-k4)'], ['', 'Other', 'var(--c-sv)']];
  function typeSplit() {
    var tot = 0, v = SPLIT.map(function () { return { val: 0, n: 0 }; });
    state.stocks.forEach(function (r) {
      if (!priced(r)) return;
      var i = SPLIT.map(function (x) { return x[0]; }).indexOf(r.type); if (i < 0) i = SPLIT.length - 1;
      var mv = n(r.qty) * n(r.price); v[i].val += mv; v[i].n++; tot += mv;
    });
    if (!tot) return '';
    var parts = SPLIT.map(function (x, i) { return { label: x[1], c: x[2], val: v[i].val, n: v[i].n }; }).filter(function (x) { return x.n; });
    return '<div class="tsplit"><div class="bal-bar tsplit-bar" role="img" aria-label="' + esc(parts.map(function (x) { return x.label + ' ' + pct(x.val / tot * 100); }).join(', ')) + '">' +
      parts.map(function (x) { return '<span style="width:' + (x.val / tot * 100).toFixed(2) + '%;background:' + x.c + '"></span>'; }).join('') + '</div>' +
      '<div class="tsplit-items">' + parts.map(function (x) {
        return '<span class="tsplit-it"><i class="dot" style="--c:' + x.c + '"></i><span>' + x.label + ' <em>' + x.n + '</em></span><b>' + money0(x.val) + '</b><small>' + pct(x.val / tot * 100) + '</small></span>';
      }).join('') + '</div></div>';
  }
  function renderStocks() {
    var t = totals(state), list = state.stocks.slice(), s = ui.sort, get = SORTS[s.key] || SORTS.ticker;
    list.sort(function (a, b) {
      var x = get(a), y = get(b);
      var c = typeof x === 'string' ? x.localeCompare(y) : (x === y ? 0 : x < y ? -1 : 1);
      return c * s.dir;
    });
    var unpriced = state.stocks.filter(function (r) { return !priced(r); });
    var keyItems = [
      ['var(--c-st)', money0(t.stockCost), 'Cost basis'],
      [t.stockGain < 0 ? 'var(--neg)' : 'var(--pos)', '<span class="' + (t.stockGain < 0 ? 'neg' : 'pos') + '">' + signed(t.stockGain) + '</span>', 'Unrealized gain' + (t.stockCostPriced ? ' · ' + sgnPct(t.stockGain / t.stockCostPriced * 100) : '')],
      ['var(--muted)', money0(taxNow(state).stocks), 'Tax if all sold · ' + pct(taxRates(state.settings).cap * 100) + ' of net gain'],
      ['var(--c-cc)', t.dayKnown ? '<span class="' + (t.dayChange < 0 ? 'neg' : 'pos') + '">' + signed(t.dayChange) + '</span>' : '—', t.dayKnown ? 'Day change · ' + t.dayKnown + (t.dayKnown === 1 ? ' quote' : ' quotes') : 'Day change · after a live refresh']
    ].map(function (k) { return '<div class="key" style="--c:' + k[0] + '"><b>' + k[1] + '</b><span>' + k[2] + '</span></div>'; }).join('');

    var head = HCOLS.map(function (c) {
      var on = s.key === c[0];
      return '<th class="sort' + (c[2] ? ' num' : '') + '"' + (on ? ' aria-sort="' + (s.dir === 1 ? 'ascending' : 'descending') + '"' : '') + '><button type="button" data-act="sort" data-key="' + c[0] + '" data-fk="sort-' + c[0] + '">' + c[1] + '</button></th>';
    }).join('') + '<th><span class="sr">Actions</span></th>';
    var body = list.map(function (r) {
      var p = priced(r), qty = n(r.qty), cost = qty * n(r.cost), mv = p ? qty * n(r.price) : null, g = p ? mv - cost : null, d = dayOf(r);
      var status = r.manual ? '<span class="tag">Manual</span>' : r.quoteError ? '<span class="tag warn" title="' + esc(r.quoteError) + '">Not updated</span>' : r.quoteTime ? '<span class="subline">' + esc((r.quoteSource || 'Updated') + ' · ' + when(r.quoteTime)) + '</span>' : '';
      var na = '<span class="na">Unavailable</span>';
      return '<tr>' +
        '<td class="lead" data-label="Ticker"><span class="tk-cell">' + logoHtml(r, 'sm') + '<span><span class="tk">' + esc(r.ticker) + '</span><br>' + status + '</span></span></td>' +
        '<td data-label="Company">' + esc(r.company) + '</td>' +
        '<td data-label="Type" class="muted">' + esc(r.type) + '</td>' +
        '<td class="num" data-label="Qty">' + qtyTxt(r.qty) + '</td>' +
        '<td class="num" data-label="Cost / share">' + money2(n(r.cost)) + '</td>' +
        '<td class="num" data-label="Price"><input class="price' + (ui.flash[r.id] ? ' flash' : '') + '" type="number" step="any" min="0" inputmode="decimal" placeholder="—" aria-label="Current price for ' + esc(r.ticker) + '" value="' + (p ? esc(n(r.price)) : '') + '" data-price="' + esc(r.id) + '" data-fk="price-' + esc(r.id) + '"></td>' +
        '<td class="num" data-label="Day">' + (d ? '<span class="' + (d.chg < 0 ? 'neg' : 'pos') + '">' + sgnPct(d.pct) + '</span>' : '<span class="muted">—</span>') + '</td>' +
        '<td class="num" data-label="Market value">' + (p ? money2(mv) : na) + '</td>' +
        '<td class="num" data-label="Gain / loss">' + (p ? '<span class="' + (g < 0 ? 'neg' : 'pos') + '">' + signed(g, usd2) + '</span>' : na) + '</td>' +
        '<td class="num" data-label="Gain %">' + (p && cost ? '<span class="' + (g < 0 ? 'neg' : 'pos') + '">' + sgnPct(g / cost * 100) + '</span>' : na) + '</td>' +
        '<td class="act"><button class="btn sm" data-act="edit" data-cat="stocks" data-id="' + esc(r.id) + '" data-fk="edit-' + esc(r.id) + '">Edit</button></td></tr>';
    }).join('');
    var foot = list.length ? '<tfoot><tr><td class="lead" data-label="">Total</td><td class="blank"></td><td class="blank"></td><td class="blank"></td><td class="num" data-label="Cost basis">' + money2(t.stockCost) + '</td><td class="blank"></td>' +
      '<td class="num" data-label="Day">' + (t.dayKnown ? '<span class="' + (t.dayChange < 0 ? 'neg' : 'pos') + '">' + signed(t.dayChange) + '</span>' : '') + '</td>' +
      '<td class="num" data-label="Market value">' + money2(t.stocks) + '</td><td class="num" data-label="Gain / loss"><span class="' + (t.stockGain < 0 ? 'neg' : 'pos') + '">' + signed(t.stockGain, usd2) + '</span></td>' +
      '<td class="num" data-label="Gain %">' + (t.stockCostPriced ? sgnPct(t.stockGain / t.stockCostPriced * 100) : '') + '</td><td class="blank"></td></tr></tfoot>' : '';
    // Phone: one compact card per holding, a sort menu and a total line, in place of the table.
    var sortOpts = PHONE_SORTS.map(function (o) { return '<option value="' + o[0] + ':' + o[1] + '"' + (s.key === o[0] && s.dir === o[1] ? ' selected' : '') + '>' + o[2] + '</option>'; }).join('');
    var cards = '<div class="hcards"><div class="hc-bar"><label for="hsort">Sort</label><select id="hsort" class="mini" data-fk="hsort">' +
      (PHONE_SORTS.some(function (o) { return s.key === o[0] && s.dir === o[1]; }) ? '' : '<option selected disabled>Choose</option>') + sortOpts + '</select></div>' +
      list.map(holdingCard).join('') + '</div>';
    // Phone: the totals sit in the Holdings heading, above the cards.
    var phoneSum = list.length ? '<span class="hc-sum"><span class="hc-sum-top"><span>' + list.length + ' holding' + (list.length === 1 ? '' : 's') + '</span><b>' + money2(t.stocks) + '</b></span>' +
      '<span>' + (t.dayKnown ? 'Today <b class="' + (t.dayChange < 0 ? 'neg' : 'pos') + '">' + signed(t.dayChange) + '</b> · ' : '') + 'Gain <b class="' + (t.stockGain < 0 ? 'neg' : 'pos') + '">' + signed(t.stockGain) + (t.stockCostPriced ? ' (' + sgnPct(t.stockGain / t.stockCostPriced * 100) + ')' : '') + '</b></span>' +
      '<span class="hc-hint">Tap a holding to edit it or enter a price.</span></span>' : '<span class="hc-hint">Add your first position to see it here.</span>';
    var table = list.length ? '<div class="tablewrap st-table"><table class="rt" style="min-width:1020px">' + '<thead><tr>' + head + '</tr></thead><tbody>' + body + '</tbody>' + foot + '</table></div>' + cards
      : '<div class="empty">No holdings yet. Add your first position to include it in totals and projections.</div>';
    var s2 = feedStatus();
    return '<header class="head"><div><div class="eyebrow">Stocks &amp; funds</div><h1>' + (feedKey() ? 'Holdings, priced live.' : 'Stocks, funds, and private holdings.') + '</h1></div>' +
      '<div class="actions">' + refreshBtn(true) + '<button class="btn" data-act="add" data-cat="stocks">Add position</button></div></header>' +
      '<div class="stock-sum"><article class="stock-intro"><div><div class="eyebrow">Stocks overview</div><div class="si-metrics"><div><span>Positions</span><b class="si-count">' + state.stocks.length + '</b></div>' +
      '<div><span>Market value</span><b class="si-total">' + money2(t.stocks) + '</b></div></div></div>' +
      '<p>' + (unpriced.length ? 'Priced positions only. ' + esc(unpriced.map(function (r) { return r.ticker; }).join(', ')) + ' ' + (unpriced.length === 1 ? 'has' : 'have') + ' no market price and ' + (unpriced.length === 1 ? 'is' : 'are') + ' left out.' : 'Every position has a price.') + '</p></article>' +
      '<article class="card keys"><div class="eyebrow">Performance</div><div class="key-grid">' + keyItems + '</div></article></div>' +
      '<section class="card panel" aria-labelledby="hTitle"><div class="panel-head"><div><h2 id="hTitle">Holdings</h2><p><span class="desk-only">Select a column heading to sort. Type a price and press Enter or Tab to save it.</span><span class="phone-only">' + phoneSum + '</span></p></div><span class="mono muted desk-only" style="font-size:11px">' + state.stocks.length + ' positions · USD</span></div>' +
      '<div class="toolbar st-toolbar"><p><span class="chip ' + s2.cls + ' desk-only" data-feed-chip>' + esc(s2.text) + '</span><span class="chip ' + s2.cls + ' phone-only" data-feed-short>' + esc(feedShort()) + '</span></p><label for="autoStocks"><span class="desk-only">Auto-refresh</span><span class="phone-only">Auto</span> ' + autoSelect('autoStocks') + '</label></div>' +
      typeSplit() +
      table + '</section>' +
      '<p class="note">Prices you type are kept until the next live refresh. Holdings marked Manual, such as private shares, are never overwritten. Day change compares the latest price with the previous close from the price feed.</p>';
  }

  /* ---------- accounts ---------- */
  /* CD terms */
  function addMonths(str, m) {
    var d = parseDate(str);
    if (!d || !(m > 0)) return '';
    var y = d.getFullYear(), mo = d.getMonth() + Math.round(m), day = d.getDate();
    var last = new Date(y, mo + 1, 0).getDate();   // keep Jan 31 + 1 month on Feb 28/29
    var out = new Date(y, mo, Math.min(day, last));
    return out.getFullYear() + '-' + String(out.getMonth() + 1).padStart(2, '0') + '-' + String(out.getDate()).padStart(2, '0');
  }
  function termMonths(r) {
    var o = parseDate(r.opened), m = parseDate(r.matures);
    if (!o || !m || m <= o) return r.term > 0 ? Math.round(r.term) : null;
    return Math.max(1, Math.round((m.getFullYear() - o.getFullYear()) * 12 + (m.getMonth() - o.getMonth()) + (m.getDate() - o.getDate()) / 30));
  }
  function daysUntil(str) {
    var d = parseDate(str);
    return d ? Math.round((d - parseDate(today())) / 864e5) : null;
  }
  function maturesIn(str) {
    var days = daysUntil(str);
    if (days == null) return '<span class="muted">—</span>';
    if (days < 0) return '<span class="tag">Matured</span>';
    if (days === 0) return '<span class="tag warn">Today</span>';
    var txt = days < 90 ? 'in ' + days + (days === 1 ? ' day' : ' days') : 'in ' + Math.round(days / 30.44) + ' mo';
    return days <= 30 ? '<span class="tag warn">' + txt + '</span>' : txt;
  }
  // Renew / Move to savings appear from 30 days before maturity, and stay until the CD is dealt with.
  function cdActions(r) {
    var d = daysUntil(r.matures);
    if (d == null || d > 30) return '';
    return '<button class="btn sm primary" data-act="cd-renew" data-id="' + esc(r.id) + '">Renew</button> <button class="btn sm" data-act="cd-move" data-id="' + esc(r.id) + '">Move to savings</button> ';
  }
  /* CD ladder: how much pays out when. Monthly bars, or calendar quarters when maturities run past 24 months. */
  var MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  function ladderCard() {
    var now = parseDate(today()), y0 = now.getFullYear(), m0 = now.getMonth();
    var items = state.cds.map(function (r) {
      var d = parseDate(r.matures); if (!d) return null;
      var v = cdAtMaturity(r), days = daysUntil(r.matures);
      // Matured CDs not yet renewed or moved count in the current month.
      return { r: r, d: d, days: days, v: v == null ? n(r.principal) : v, idx: Math.max(0, (d.getFullYear() - y0) * 12 + d.getMonth() - m0) };
    }).filter(Boolean);
    if (!items.length) return '';
    var last = Math.max.apply(null, items.map(function (i) { return i.idx; }));
    var monthly = [];
    for (var i = 0; i <= last; i++) monthly.push(0);
    items.forEach(function (it) { monthly[it.idx] += it.v; });

    var quarterly = last + 1 > 24, off = m0 % 3;
    var key = function (idx) { return quarterly ? Math.floor((idx + off) / 3) : idx; };
    var nb = key(last) + 1, buckets = [];
    for (var b = 0; b < nb; b++) {
      var startIdx = quarterly ? Math.max(0, b * 3 - off) : b, mAbs = m0 + startIdx;
      var yy = y0 + Math.floor(mAbs / 12), mm = mAbs % 12;
      buckets.push({ v: 0, items: [], soon: false, label: quarterly ? 'Q' + (Math.floor(mm / 3) + 1) : MON[mm], year: (b === 0 || mm < (quarterly ? 3 : 1)) ? String(yy) : '', long: quarterly ? 'Q' + (Math.floor(mm / 3) + 1) + ' ' + yy : MON[mm] + ' ' + yy });
    }
    items.forEach(function (it) { var bk = buckets[key(it.idx)]; bk.v += it.v; bk.items.push(it); if (it.days <= 30) bk.soon = true; });

    // Summary figures.
    var next12 = items.filter(function (it) { return it.idx < 12; });
    var next12v = next12.reduce(function (a, it) { return a + it.v; }, 0);
    var peak = buckets.reduce(function (a, bk) { return bk.v > a.v ? bk : a; }, buckets[0]);
    var gap = { len: 0, from: 0 }, run = 0;
    for (var j = 0; j <= last; j++) {
      if (monthly[j] === 0) { run++; if (run > gap.len) gap = { len: run, from: j - run + 1 }; } else run = 0;
    }
    var monthName = function (idx) { var a = m0 + idx; return MON[a % 12] + ' ' + (y0 + Math.floor(a / 12)); };
    var stats = '<div><span>Next 12 months</span><b>' + money0(next12v) + '</b><em>' + next12.length + ' CD' + (next12.length === 1 ? '' : 's') + ' paying out</em></div>' +
      '<div><span>Biggest payout ' + (quarterly ? 'quarter' : 'month') + '</span><b>' + money0(peak.v) + '</b><em>' + peak.long + ' · ' + peak.items.length + ' CD' + (peak.items.length === 1 ? '' : 's') + '</em></div>' +
      '<div><span>Longest stretch with nothing maturing</span><b>' + (gap.len ? gap.len + ' month' + (gap.len === 1 ? '' : 's') : 'None') + '</b><em>' + (gap.len ? monthName(gap.from) + (gap.len > 1 ? ' – ' + monthName(gap.from + gap.len - 1) : '') : 'Something matures every month') + '</em></div>';

    // Chart.
    var W = Math.max(900, nb * 50), H = 250, L = 12, R = 12, T = 26, B = 46, plotH = H - T - B;
    var bw = (W - L - R) / nb, mx = Math.max.apply(null, buckets.map(function (bk) { return bk.v; }).concat([1]));
    var every = nb > 18 ? 2 : 1, out = '<line class="grid" x1="' + L + '" x2="' + (W - R) + '" y1="' + (T + plotH) + '" y2="' + (T + plotH) + '"/>';
    buckets.forEach(function (bk, k) {
      var x = L + k * bw + bw * 0.18, w = bw * 0.64, cx = x + w / 2;
      if (bk.v > 0) {
        var hgt = Math.max(3, bk.v / mx * plotH), y = T + plotH - hgt;
        var tip = bk.long + ': ' + money0(bk.v) + '\n' + bk.items.map(function (it) { return it.r.name + ' · ' + money0(it.v) + (it.days < 0 ? ' · matured ' : ' on ') + fmtDate(it.r.matures); }).join('\n');
        out += '<g><title>' + esc(tip) + '</title><rect class="' + (bk.soon ? 'lad-soon' : 'lad-bar') + '" x="' + x.toFixed(1) + '" y="' + y.toFixed(1) + '" width="' + w.toFixed(1) + '" height="' + hgt.toFixed(1) + '" rx="3"/>' +
          '<text class="ax" x="' + cx.toFixed(1) + '" y="' + (y - 6).toFixed(1) + '" text-anchor="middle">' + short(bk.v) + '</text></g>';
      } else {
        out += '<rect class="lad-empty" x="' + x.toFixed(1) + '" y="' + (T + plotH - 3) + '" width="' + w.toFixed(1) + '" height="3" rx="1.5"/>';
      }
      if (k % every === 0 || bk.v > 0) out += '<text class="ax" x="' + cx.toFixed(1) + '" y="' + (H - 26) + '" text-anchor="middle">' + bk.label + '</text>';
      if (bk.year) out += '<text class="ax lad-year" x="' + cx.toFixed(1) + '" y="' + (H - 8) + '" text-anchor="middle">' + bk.year + '</text>';
    });
    var svg = '<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="CD payouts by ' + (quarterly ? 'quarter' : 'month') + '; the table below lists each CD" style="width:100%;min-width:' + Math.min(W, 620) + 'px;height:auto;display:block">' + out + '</svg>';
    var hint = gap.len >= 3 ? '<p class="note" style="margin:0 22px">A new CD with a term ending between ' + monthName(gap.from) + ' and ' + monthName(gap.from + gap.len - 1) + ' would fill the longest gap.</p>' : '';
    return '<section class="card ladder" aria-labelledby="ladTitle"><div class="panel-head"><div><h2 id="ladTitle">CD ladder</h2><p>How much pays out each ' + (quarterly ? 'quarter' : 'month') + ', at maturity value. Hover a bar for the CDs in it.</p></div>' +
      '<span class="c-legend"><span><i class="dot" style="--c:var(--c-cc)"></i>Paying out</span><span><i class="dot" style="--c:var(--accent)"></i>Within 30 days or matured</span></span></div>' +
      '<div class="lad-stats">' + stats + '</div><div class="chart-scroll lad-chart">' + svg + '</div>' + hint + '</section>';
  }
  function nextMaturity() {
    var next = state.cds.map(function (r) { return { r: r, d: daysUntil(r.matures) }; }).filter(function (x) { return x.d != null && x.d >= 0; }).sort(function (a, b) { return a.d - b.d; })[0];
    var label = next ? fmtDate(next.r.matures) : '—';
    var sub = next ? (next.d === 0 ? 'today' : 'in ' + next.d + (next.d === 1 ? ' day' : ' days')) : 'none scheduled';
    return '<div class="card stat"><span>Next maturity · ' + sub + '</span><b class="' + (next && next.d <= 30 ? 'neg' : '') + '">' + label + '</b></div>';
  }
  // In the CD form, the term and the maturity date keep each other in step.
  function wireCdTerm() {
    var o = $('#f_opened'), t = $('#f_term'), m = $('#f_matures');
    if (!o || !t || !m) return;
    var fromTerm = function () { var v = addMonths(o.value, parseFloat(t.value)); if (v) m.value = v; };
    t.addEventListener('input', fromTerm);
    o.addEventListener('change', function () { if (t.value) fromTerm(); });
    m.addEventListener('change', function () { var k = termMonths({ opened: o.value, matures: m.value }); if (k) t.value = k; });
  }

  var COLS = {
    k401: [
      ['Account', function (r) { return '<strong>' + esc(r.name) + '</strong>'; }],
      ['Balance', function (r) { return money2(n(r.balance)); }, 'num'],
      ['Added per year', function (r) { return money2(n(r.contrib)); }, 'num']
    ],
    cds: [
      ['Name', function (r) { return '<strong>' + esc(r.name) + '</strong>'; }],
      ['APY', function (r) { return n(r.apy).toFixed(2) + '%'; }, 'num'],
      ['Principal', function (r) { return money2(n(r.principal)); }, 'num'],
      ['Value today', function (r) { return money2(cdValueNow(r)); }, 'num'],
      ['Term', function (r) { var m = termMonths(r); return m == null ? '—' : m + ' mo'; }, 'num'],
      ['Opened', function (r) { return '<span class="muted">' + fmtDate(r.opened) + '</span>'; }],
      ['Matures', function (r) { return fmtDate(r.matures); }],
      ['Matures in', function (r) { return maturesIn(r.matures); }],
      ['At maturity', function (r) { var v = cdAtMaturity(r); return v == null ? '—' : money2(v); }, 'num']
    ],
    cash: [
      ['Account', function (r) { return '<strong>' + esc(r.name) + '</strong>'; }],
      ['APY', function (r) { return n(r.apy).toFixed(2) + '%'; }, 'num'],
      ['Balance', function (r) { return money2(n(r.balance)); }, 'num']
    ],
    assets: [
      ['Asset', function (r) { return '<strong>' + esc(r.name) + '</strong>'; }],
      ['Est. value', function (r) { return money2(n(r.value)); }, 'num'],
      ['Change / year', function (r) { return '<span class="' + (n(r.growth) < 0 ? 'neg' : '') + '">' + sgnPct(n(r.growth)) + '</span>'; }, 'num']
    ],
    mortgage: [
      ['Loan', function (r) { return '<strong>' + esc(r.name) + '</strong>'; }],
      ['Type', function (r) { return '<span class="muted">' + esc(r.kind || 'Mortgage') + '</span>'; }],
      ['Balance', function (r) { return '<span class="neg">' + money2(n(r.balance)) + '</span>'; }, 'num'],
      ['Rate', function (r) { return n(r.rate).toFixed(2) + '%'; }, 'num'],
      ['Monthly payment', function (r) { return money2(n(r.payment)); }, 'num'],
      ['Time left', function (r) {
        var m = payoffMonths(r);
        if (m == null) return '<span class="neg">Payment too low</span>';
        if (m === 0) return 'Paid off';
        var d = new Date(); d.setMonth(d.getMonth() + m);
        return Math.floor(m / 12) + ' yr ' + (m % 12) + ' mo · ' + d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
      }]
    ]
  };
  var TOTAL_COL = { k401: 1, cds: 3, cash: 2, assets: 1, mortgage: 2 };
  var ACCT_TABS = ['k401', 'cds', 'cash', 'assets', 'mortgage'];
  function statCards(k) {
    var t = totals(state), c = function (l, v, cls) { return '<div class="card stat"><span>' + l + '</span><b class="' + (cls || '') + '">' + v + '</b></div>'; };
    if (k === 'k401') return c('Balance', money0(t.k401)) + c('Added per year', money0(state.k401.reduce(function (a, r) { return a + n(r.contrib); }, 0))) + c('Accounts', state.k401.length);
    if (k === 'cds') return c('Value today · ' + signed(t.cds - state.cds.reduce(function (a, r) { return a + n(r.principal); }, 0)) + ' interest', money0(t.cds)) + c('Average APY', wavg(state.cds, 'principal').toFixed(2) + '%') + nextMaturity();
    if (k === 'cash') {
      var me = n(state.settings.monthlyExpenses);
      return c('Total cash', money0(t.cash)) + c('Average APY', wavg(state.cash, 'balance').toFixed(2) + '%') + c('Months of spending', me ? (t.cash / me).toFixed(1) : '—');
    }
    if (k === 'assets') return c('Total value', money0(t.assets)) + c('Equity after loans', money0(Math.max(0, t.assets - t.mortgage)), 'pos') + c('Items', state.assets.length);
    return c('Balance owed', money0(t.mortgage), 'neg') + c('Monthly payments', money0(state.mortgage.reduce(function (a, r) { return a + n(r.payment); }, 0))) + c('Loans', state.mortgage.length);
  }
  /* Phone layout for Accounts: one balance-sheet card, then an accordion with one row per category. Tapping a row
     opens its accounts underneath (one category open at a time); tapping an account opens its edit dialog. */
  var CHEV = '<svg class="ac-chev" aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 6 6 6-6 6"/></svg>';
  function acNote(k) {
    var list = state[k], c = list.length;
    if (!c) return 'Nothing added yet';
    var count = c + ' ' + (k === 'cds' ? (c === 1 ? 'CD' : 'CDs') : k === 'mortgage' ? (c === 1 ? 'loan' : 'loans') : k === 'assets' ? (c === 1 ? 'asset' : 'assets') : (c === 1 ? 'account' : 'accounts'));
    if (k === 'k401') return count + ' · ' + signed(list.reduce(function (a, r) { return a + n(r.contrib); }, 0)) + ' a year';
    if (k === 'cds') {
      var next = list.filter(function (r) { return parseDate(r.matures) && daysUntil(r.matures) >= 0; }).sort(function (a, b) { return parseDate(a.matures) - parseDate(b.matures); })[0];
      var due = list.filter(function (r) { var d = daysUntil(r.matures); return d != null && d < 0; }).length;
      return count + (due ? ' · ' + due + ' matured' : '') + (next ? ' · next matures ' + parseDate(next.matures).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }) : '');
    }
    if (k === 'cash') return count + ' · ' + wavg(list, 'balance').toFixed(2) + '% average APY';
    if (k === 'assets') return count + ' · estimated value';
    return catNote(k);
  }
  function acItem(k, r) {
    var val, sub, sub2 = '';
    if (k === 'k401') { val = money2(n(r.balance)); sub = signed(n(r.contrib)) + ' a year'; }
    else if (k === 'cds') {
      val = money2(cdValueNow(r)); sub = n(r.apy).toFixed(2) + '% · matures ' + fmtDate(r.matures) + ' · ' + maturesIn(r.matures);
      var am = cdAtMaturity(r); sub2 = 'Principal ' + money0(n(r.principal)) + (am == null ? '' : ' · ' + money0(am) + ' at maturity');
    }
    else if (k === 'cash') { val = money2(n(r.balance)); sub = n(r.apy).toFixed(2) + '% APY'; }
    else if (k === 'assets') { val = money2(n(r.value)); sub = '<span class="' + (n(r.growth) < 0 ? 'neg' : '') + '">' + sgnPct(n(r.growth)) + '</span> a year'; }
    else { val = '<span class="neg">−' + money2(n(r.balance)) + '</span>'; sub = esc(r.kind || 'Mortgage') + ' · ' + n(r.rate).toFixed(2) + '% · ' + money0(n(r.payment)) + '/mo'; sub2 = COLS.mortgage[5][1](r); }
    var acts = k === 'cds' ? cdActions(r) : '';
    return '<div class="ac-item"><button type="button" class="ac-item-main" data-act="edit" data-cat="' + k + '" data-id="' + esc(r.id) + '" aria-label="Edit ' + esc(r.name) + '">' +
      '<span class="ac-item-top"><b>' + esc(r.name) + '</b><b class="ac-item-val">' + val + '</b></span>' +
      '<span class="ac-item-sub">' + sub + '</span>' + (sub2 ? '<span class="ac-item-sub">' + sub2 + '</span>' : '') + '</button>' +
      (acts ? '<div class="ac-item-acts">' + acts + '</div>' : '') + '</div>';
  }
  function accountsPhone(t) {
    var A = t.totalAssets || 1;
    var parts = [['Investments', t.stocks + t.k401, 'var(--c-st)'], ['Cash & CDs', t.cash + t.cds, 'var(--c-cc)'], ['Property & assets', t.assets, 'var(--c-eq)']];
    var bs = '<article class="card ac-bs"><div class="ac-bs-top"><span>Assets <b>' + money0(t.totalAssets) + '</b></span><span>Owed <b class="' + (t.liabilities ? 'neg' : '') + '">' + (t.liabilities ? '−' : '') + money0(t.liabilities) + '</b></span></div>' +
      '<div class="bal-bar" role="img" aria-label="' + esc(parts.map(function (p) { return p[0] + ' ' + money0(p[1]); }).join(', ')) + '">' + parts.map(function (p) { return '<span style="width:' + (p[1] / A * 100).toFixed(2) + '%;background:' + p[2] + '"></span>'; }).join('') + '</div>' +
      '<div class="ac-bs-rows">' + parts.map(function (p) { return '<span><i class="dot" style="--c:' + p[2] + '"></i>' + p[0] + '</span><b>' + money0(p[1]) + '</b>'; }).join('') +
      '<i class="ac-bs-rule"></i><span class="ac-bs-net">Net worth</span><b class="ac-bs-net">' + money0(t.net) + '</b></div></article>';
    var rows = ACCT_TABS.map(function (k) {
      var open = ui.acOpen === k, neg = k === 'mortgage' && t[k];
      var body = '';
      if (open) {
        body = '<div class="ac-body" id="ac-' + k + '">' + state[k].map(function (r) { return acItem(k, r); }).join('') +
          '<button type="button" class="ac-add" data-act="add" data-cat="' + k + '">+ Add ' + CATS[k].one + '</button>' +
          (k === 'cds' && state.cds.length ? '<div class="ac-ladder">' + ladderCard() + '</div>' : '') + '</div>';
      }
      return '<div class="ac-cat' + (open ? ' open' : '') + '"><button type="button" class="ac-row" data-act="ac-toggle" data-cat="' + k + '" aria-expanded="' + open + '" aria-controls="ac-' + k + '">' +
        '<span class="glyph">' + icon(k) + '</span><span class="ac-name"><b>' + CATS[k].label + '</b><span>' + esc(acNote(k)) + '</span></span>' +
        '<b class="ac-total' + (neg ? ' neg' : '') + '">' + (neg ? '−' : '') + money0(t[k]) + '</b>' + CHEV + '</button>' + body + '</div>';
    }).join('');
    return '<div class="ac-phone">' + bs + '<div class="card ac-list">' + rows + '</div>' +
      '<p class="note">Stocks and funds live on the <a href="#/stocks">Stocks</a> page, where prices can refresh automatically.</p></div>';
  }
  function renderAccounts() {
    var t = totals(state), k = ACCT_TABS.indexOf(ui.tab) >= 0 ? ui.tab : 'k401', cols = COLS[k], list = state[k];
    var strip = [['Investments', t.stocks + t.k401], ['Cash & CDs', t.cash + t.cds], ['Property & assets', t.assets], ['Liabilities', -t.liabilities]].map(function (x) {
      return '<div><span>' + x[0] + '</span><b class="' + (x[1] < 0 ? 'neg' : '') + '">' + money0(x[1]) + '</b></div>';
    }).join('');
    var tabs = ACCT_TABS.map(function (key) {
      return '<button type="button" class="tab" data-act="tab" data-cat="' + key + '" data-fk="tab-' + key + '" aria-pressed="' + (key === k) + '"><span class="l">' + CATS[key].label + '</span><span class="v">' + (key === 'mortgage' && t[key] ? '−' : '') + money0(t[key]) + '</span></button>';
    }).join('');
    var head = cols.map(function (c) { return '<th' + (c[2] ? ' class="num"' : '') + '>' + c[0] + '</th>'; }).join('') + '<th><span class="sr">Actions</span></th>';
    var body = list.map(function (r) {
      return '<tr>' + cols.map(function (c, i) { return '<td' + (i === 0 ? ' class="lead"' : c[2] ? ' class="num"' : '') + ' data-label="' + c[0] + '">' + c[1](r) + '</td>'; }).join('') +
        '<td class="act">' + (k === 'cds' ? cdActions(r) : '') + '<button class="btn sm" data-act="edit" data-cat="' + k + '" data-id="' + esc(r.id) + '" data-fk="edit-' + esc(r.id) + '">Edit</button></td></tr>';
    }).join('');
    var foot = '';
    if (list.length) {
      foot = '<tfoot><tr>' + cols.map(function (c, i) {
        if (i === 0) return '<td class="lead">Total</td>';
        if (i === TOTAL_COL[k]) return '<td class="num" data-label="' + c[0] + '">' + money2(t[k]) + '</td>';
        return '<td class="blank"></td>';
      }).join('') + '<td class="blank"></td></tr></tfoot>';
    }
    var table = list.length ? '<div class="tablewrap"><table class="rt" style="min-width:' + (k === 'cds' ? 1000 : 640) + 'px"><thead><tr>' + head + '</tr></thead><tbody>' + body + '</tbody>' + foot + '</table></div>'
      : '<div class="empty">No ' + CATS[k].label.toLowerCase() + ' yet. Add your first ' + CATS[k].one + ' to include it in totals and projections.</div>';
    var note = k === 'cds' ? '“At maturity” assumes the APY compounds yearly from the opened date to the maturity date.' : '';
    return '<header class="head"><div><div class="eyebrow">Balance sheet</div><h1>Every account, one clear picture.</h1></div><div class="actions"><a class="btn" href="#/stocks">Stocks &amp; funds</a><a class="btn primary" href="#/projections">Open projections</a></div></header>' +
      accountsPhone(t) + '<div class="ac-desk">' +
      '<div class="strip" aria-label="Balance sheet totals">' + strip + '</div>' +
      '<div class="tabs" role="group" aria-label="Account types">' + tabs + '</div>' +
      '<div class="stats">' + statCards(k) + '</div>' +
      '<section class="card panel"><div class="panel-head"><h2>' + CATS[k].label + '</h2><button class="btn primary" data-act="add" data-cat="' + k + '">Add ' + CATS[k].one + '</button></div>' + table + '</section>' +
      (note ? '<p class="note">' + note + '</p>' : '') +
      (k === 'cds' ? ladderCard() : '') +
      '<p class="note">Stocks and funds live on the <a href="#/stocks">Stocks</a> page, where prices can refresh automatically.</p></div>';
  }

  /* ---------- projections ---------- */
  function stackedChart(rows) {
    var W = 900, H = 310, L = 64, R = 12, T = 14, B = 34;
    var stacks = rows.map(function (r) { return { eq: Math.max(0, r.assets - r.mortgage), k4: r.k401, st: r.stocks, cc: r.cds + r.cash }; });
    var mx = Math.max.apply(null, stacks.map(function (s) { return s.eq + s.k4 + s.st + s.cc; }).concat([1]));
    var step = niceStep(mx / 4), top = Math.ceil(mx / step) * step;
    var plotH = H - T - B, bw = (W - L - R) / rows.length, gap = Math.min(6, bw * 0.2);
    var Y = function (v) { return T + plotH - v / top * plotH; };
    var out = '';
    for (var g = 0; g <= top + 1; g += step) out += '<line class="grid" x1="' + L + '" x2="' + (W - R) + '" y1="' + Y(g).toFixed(1) + '" y2="' + Y(g).toFixed(1) + '"/><text class="ax" x="' + (L - 8) + '" y="' + (Y(g) + 4).toFixed(1) + '" text-anchor="end">' + short(g) + '</text>';
    var every = Math.ceil(rows.length / 10);
    rows.forEach(function (r, i) {
      var x = L + i * bw + gap / 2, w = Math.max(2, bw - gap), acc = 0, s = stacks[i];
      out += '<g><title>' + esc((i === 0 ? 'Today' : r.year) + ' · net worth ' + money0(r.net)) + '</title>';
      [['eq', 'f-eq'], ['st', 'f-st'], ['k4', 'f-k4'], ['cc', 'f-cc']].forEach(function (c) {
        var v = s[c[0]]; if (v <= 0) return;
        var y1 = Y(acc + v);
        out += '<rect class="' + c[1] + '" x="' + x.toFixed(1) + '" y="' + y1.toFixed(1) + '" width="' + w.toFixed(1) + '" height="' + Math.max(0, Y(acc) - y1).toFixed(1) + '"/>';
        acc += v;
      });
      out += '</g>';
      if (i % every === 0 || i === rows.length - 1) out += '<text class="ax" x="' + (x + w / 2).toFixed(1) + '" y="' + (H - 12) + '" text-anchor="middle">' + (i === 0 ? 'Now' : '’' + String(r.year).slice(2)) + '</text>';
    });
    return '<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Stacked columns of projected net worth by year; the table below lists the same figures" style="width:100%;height:auto;display:block;min-width:520px">' + out + '</svg>';
  }
  function goalCard() {
    var g = goalStatus(state), st = state.settings;
    if (!g.ok) return '<article class="card goal"><div class="eyebrow">Retirement goal</div><p>Set your age, retirement age and the yearly income you want in <a href="#/settings">Settings</a> to see whether you are on track.</p></article>';
    var on = g.gap <= 0, fill = g.target > 0 ? Math.max(2, Math.min(100, g.after / g.target * 100)) : 100;
    var hz = Math.round(n(st.horizon)) || 15;
    var incomeLine = incomeSummary(g);
    return '<article class="card goal"><div class="goal-top"><div><div class="eyebrow">Retirement goal · age ' + g.age + ' in ' + g.year + '</div>' +
      '<h2>' + money0(g.monthly) + ' a month in retirement <span class="muted" style="font-weight:500">· ' + money0(g.income) + ' a year</span></h2></div><span class="status ' + (on ? 'ok' : 'short') + '">' + (on ? 'On track' : 'Short of goal') + '</span></div>' +
      '<div class="goal-nums"><div><span>Projected at retirement, after tax</span><b>' + money0(g.after) + '</b></div><div><span>Needed' + (g.real ? '' : ' in ' + g.year + ' dollars') + '</span><b class="muted">' + money0(g.target) + '</b></div></div>' +
      '<div class="goal-bar" role="img" aria-label="' + (g.target > 0 ? Math.round(g.after / g.target * 100) : 100) + '% of goal"><i class="' + (on ? 'ok' : '') + '" style="width:' + fill.toFixed(1) + '%"></i></div>' +
      '<p>' + (on ? '<b>Ahead by ' + money0(-g.gap) + '.</b> ' : '<b>Short by ' + money0(g.gap) + '.</b> About <b>' + money0(g.extra) + ' more a year</b>, invested like your stocks, would close the gap. ') +
      'Your savings' + (g.streams.length ? ' and guaranteed income' : '') + ' would support about <b>' + money0(g.incomeToday / 12) + ' a month</b> (' + money0(g.incomeToday) + ' a year) in today’s dollars at a ' + pct(g.rate * 100) + ' withdrawal rate.</p>' + incomeLine +
      '<p class="goal-note">Counts stocks, 401(k), CDs and savings after estimated taxes; home equity is left out. ' +
      'Needed = ' + money0(g.fromSavings / 12) + ' a month from savings ÷ ' + pct(g.rate * 100) + ' withdrawal rate' + (g.bridge > 0.5 ? ' + ' + money0(g.bridge) + ' bridge' : '') + ' = ' + money0(g.targetToday) + ' in today’s dollars' + (g.real ? '. ' : ', or ' + money0(g.target) + ' in ' + g.year + ' after ' + pct(n(st.inflation)) + ' yearly inflation. ') +
      'Uses the scenario and contributions on the left.</p>' + mcLine() +
      '<div class="actions">' + (hz !== g.yrs ? '<button class="btn sm" data-act="horizon-goal">Show projections to ' + g.year + '</button>' : '') + '<a class="btn sm" href="#/settings">Change goal</a></div></article>';
  }
  function incomeSummary(g) {
    if (!g.streams.length) return '<p>Add your Social Security estimate in <a href="#/settings">Settings</a>. It lowers what your savings need to cover.</p>';
    var parts = g.streams.map(function (x) { return '<b>' + money0(x.net) + '</b> ' + (x.key === 'other' ? 'other income' : x.key === 'spouse' ? 'spouse’s Social Security' : 'Social Security') + ' from age ' + Math.round(x.startAge * 10) / 10; });
    var gaps = g.streams.filter(function (x) { return x.startAge > g.age; }).map(function (x) { return x.startAge; });
    return '<p>Guaranteed income after tax: ' + parts.join(', ') + '. Savings need to cover <b>' + money0(g.fromSavings / 12) + ' a month</b>' +
      (g.bridge > 0.5 ? ', plus <b>' + money0(g.bridge) + '</b> to bridge the years from ' + g.age + ' until ' + (gaps.length === 1 ? 'age ' + Math.round(gaps[0] * 10) / 10 : 'each source starts') : '') + '.</p>';
  }
  /* Ticker tape under the net worth panel: market symbols first, then each auto-priced holding (once per ticker),
     with the latest price and the change from the previous close as of the last refresh. It scrolls slowly, pauses
     while hovered or focused, and is a still, swipeable row when the device asks for reduced motion. */
  function tickerTape() {
    var items = [], seen = {};
    var item = function (sym, label, price, prev, href) {
      var d = prev > 0 ? (price - prev) / prev * 100 : null;
      return '<a class="tp" href="' + href + '"' + (href === '#/stocks' ? ' data-act="movers-all"' : '') + '>' + (label ? '<span class="tp-lab">' + esc(label) + '</span>' : '') + '<b>' + esc(sym) + '</b><span class="tp-px">' + px(price) + '</span>' +
        (d == null ? '' : '<span class="' + (d < 0 ? 'neg' : 'pos') + '">' + (d < 0 ? '▼ ' : '▲ ') + sgnPct(d) + '</span>') + '</a>';
    };
    var asOf = 0;
    if (state.settings.tickerMarket) MARKET.forEach(function (m) {
      var held = state.stocks.filter(function (r) { return !r.manual && priced(r) && String(r.symbol || r.ticker).toUpperCase() === m[0]; })[0];
      var q = held ? { price: n(held.price), prevClose: held.prevClose, quoteTime: held.quoteTime } : state.market[m[0]];
      if (!q || !(n(q.price) > 0)) return;
      items.push(item(m[0], m[1], n(q.price), n(q.prevClose), '#/stocks')); asOf = Math.max(asOf, n(q.quoteTime));
    });
    var mine = state.stocks.filter(function (r) { return !r.manual && priced(r); }).sort(function (a, b) { return String(a.ticker).localeCompare(String(b.ticker)); });
    var tot = 0, prevTot = 0;
    mine.forEach(function (r) {
      var d = dayOf(r); if (d) { tot += n(r.qty) * d.chg; prevTot += n(r.qty) * r.prevClose; }
      asOf = Math.max(asOf, n(r.quoteTime));
      var k = String(r.ticker).toUpperCase(); if (seen[k]) return; seen[k] = 1;
      items.push(item(r.ticker, '', n(r.price), n(r.prevClose), '#/stocks'));
    });
    if (!items.length) return '';
    if (prevTot) items.push('<a class="tp tp-tot" href="#/stocks" data-act="movers-all"><span class="tp-lab">Your stocks today</span><b class="' + (tot < 0 ? 'neg' : 'pos') + '">' + signed(tot) + ' (' + sgnPct(tot / prevTot * 100) + ')</b></a>');
    // Repeat short lists so the strip is always wider than the screen, then double it for a seamless loop.
    var run = items.slice(); while (run.length < 10) run = run.concat(items);
    var secs = Math.max(20, run.length * 4);
    // A negative delay tied to the clock keeps the strip's position steady when the page redraws.
    var delay = -((Date.now() / 1000) % secs);
    return '<section class="tape" aria-label="Prices as of the last refresh">' + (asOf ? '<span class="tape-asof">As of ' + esc(when(asOf)) + '</span>' : '') +
      '<div class="tape-view"><div class="tape-track" style="animation-duration:' + secs + 's;animation-delay:' + delay.toFixed(2) + 's">' +
      '<div class="tape-run">' + run.join('') + '</div><div class="tape-run tape-dup" aria-hidden="true">' + run.join('').replace(/<a /g, '<a tabindex="-1" ') + '</div></div></div></section>';
  }

  // Today's biggest gainer and loser among your priced holdings, ranked by percent change from the previous close.
  function moversCard() {
    var moves = state.stocks.map(function (r) { var d = dayOf(r); return d ? { r: r, d: d, usd: n(r.qty) * d.chg } : null; }).filter(Boolean);
    var head = '<article class="card insight movers"><div class="mv-head"><h3>Today’s movers</h3>';
    if (!moves.length) return head + '</div><p>Refresh prices to see which of your holdings moved most today. Holdings you price by hand are left out.</p>' + refreshBtn(false) + '</article>';
    moves.sort(function (a, b) { return b.d.pct - a.d.pct; });
    var top = moves[0].d.pct > 0 ? moves[0] : null, low = moves[moves.length - 1].d.pct < 0 ? moves[moves.length - 1] : null;
    var asOf = Math.max.apply(null, moves.map(function (m) { return n(m.r.quoteTime); }));
    var tile = function (m, up) {
      if (!m) return '<div class="mv empty"><span class="eyebrow">' + (up ? 'Top gainer' : 'Top loser') + '</span><span class="sub">' + (up ? 'Nothing up today' : 'Nothing down today') + '</span></div>';
      var q = n(m.r.qty);
      return '<a class="mv" href="#/stocks" data-act="movers-all"><span class="eyebrow">' + (up ? 'Top gainer' : 'Top loser') + '</span>' +
        '<span class="mv-line"><b class="mv-tk">' + esc(m.r.ticker) + '</b><b class="' + (up ? 'pos' : 'neg') + '">' + (up ? '▲ ' : '▼ ') + sgnPct(m.d.pct) + '</b></span>' +
        '<span class="sub">' + px(n(m.r.price)) + ' (' + pxSigned(m.d.chg) + ')</span>' +
        '<span class="sub">' + signed(m.usd) + ' on ' + qtyTxt(q) + ' share' + (q === 1 || hiding() ? '' : 's') + '</span></a>';
    };
    var prev = moves.reduce(function (a, m) { return a + n(m.r.qty) * m.r.prevClose; }, 0), tot = moves.reduce(function (a, m) { return a + m.usd; }, 0);
    var priceable = state.stocks.filter(function (r) { return !r.manual; }).length;
    return head + (asOf ? '<span class="muted">Prices as of ' + esc(when(asOf)) + '</span>' : '') + '</div>' +
      '<div class="mv-grid">' + tile(top, true) + tile(low, false) + '</div>' +
      '<p class="mv-foot">All your stocks today: <b class="' + (tot < 0 ? 'neg' : 'pos') + '">' + signed(tot) + (prev ? ' (' + sgnPct(tot / prev * 100) + ')' : '') + '</b>' +
      (moves.length < priceable ? ' · ' + moves.length + ' of ' + priceable + ' holdings have today’s change' : '') + '. <a href="#/stocks" data-act="movers-all">See all</a></p></article>';
  }
  function goalMini() {
    var g = goalStatus(state);
    if (!g.ok) return '';
    var on = g.gap <= 0;
    return '<article class="card insight"><div class="eyebrow">Retirement goal · ' + g.year + '</div><div class="metric ' + (on ? 'pos' : 'neg') + '">' + (on ? 'On track' : 'Short ' + short(g.gap)) + '</div>' +
      '<p>' + (on ? 'Projected ' + money0(g.after) + ' after tax at ' + g.age + ', above the ' + money0(g.target) + ' needed for ' + money0(g.monthly) + ' a month.' : 'About ' + money0(g.extra) + ' more a year would reach the ' + money0(g.target) + ' needed for ' + money0(g.monthly) + ' a month at ' + g.age + '.') + '</p>' +
      mcLine() + '<a class="btn" href="#/projections">See the plan</a></article>';
  }
  function projOutputs() {
    return goalCard() + (state.settings.projView === 'accounts' ? blockOutputs() : combinedOutputs());
  }
  /* Phone layout for the combined projection: a Today-vs-final-year card, then one compact row per year with a mix
     bar (same colors as the chart, scaled to the largest year) that opens to the full breakdown. */
  function projPhone(rows) {
    var st = state.settings, first = rows[0], last = rows[rows.length - 1];
    var inv = function (r) { return r.stocks + r.k401 + r.cds + r.cash; };
    var line = function (c, label, a, b, neg) {
      var f = function (v) { return neg ? (v > 0.5 ? '<span class="neg">−' + money0(v) + '</span>' : '$0') : money0(v); };
      return '<span class="pj-l">' + (c ? '<i class="dot" style="--c:' + c + '"></i>' : '') + label + '</span><span>' + f(a) + '</span><b>' + f(b) + '</b>';
    };
    var cmp = '<article class="card pj-cmp"><div class="pj-grid"><span></span><span class="pj-h">Today</span><span class="pj-h">' + last.year + '</span>' +
      line('', 'Investments &amp; cash', inv(first), inv(last)) +
      line('', 'Home &amp; vehicle', first.assets, last.assets) +
      line('', 'Loans left', first.mortgage, last.mortgage, true) +
      '<i class="pj-rule"></i><span class="pj-l pj-net">Net worth' + (st.afterTax ? ' after tax' : '') + '</span><span class="pj-net">' + money0(first.net) + '</span><b class="pj-net">' + money0(last.net) + '</b></div></article>';
    var stack = function (r) { return [['var(--c-eq)', Math.max(0, r.assets - r.mortgage)], ['var(--c-st)', r.stocks], ['var(--c-k4)', r.k401], ['var(--c-cc)', r.cds + r.cash]]; };
    var mx = Math.max.apply(null, rows.map(function (r) { return stack(r).reduce(function (a, x) { return a + Math.max(0, x[1]); }, 0); }).concat([1]));
    var age0 = n(st.goalAge), retire = n(st.goalRetireAge);
    var list = rows.map(function (r, i) {
      var open = ui.pjOpen === i, dlt = i ? r.net - rows[i - 1].net : 0, age = age0 ? age0 + r.y : 0;
      var bar = stack(r).map(function (x) { return '<span style="width:' + (Math.max(0, x[1]) / mx * 100).toFixed(2) + '%;background:' + x[0] + '"></span>'; }).join('');
      var det = '';
      if (open) {
        var d = function (l, v, cls) { return '<span>' + l + '</span><b class="' + (cls || '') + '">' + v + '</b>'; };
        det = '<div class="pj-det">' + d('Stocks &amp; funds', money0(r.stocks)) + d('401(k)', money0(r.k401)) + d('CDs &amp; cash', money0(r.cds + r.cash)) + d('Home &amp; vehicle', money0(r.assets)) +
          d('Loans', r.mortgage > 0.5 ? '−' + money0(r.mortgage) : '$0', r.mortgage > 0.5 ? 'neg' : '') +
          (st.afterTax && r.taxStocks + r.tax401 > 0.5 ? d('Already less est. taxes', '−' + money0(r.taxStocks + r.tax401), 'muted') : '') + '</div>';
      }
      return '<div class="pj-yr' + (open ? ' open' : '') + '"><button type="button" class="pj-row" data-act="pj-year" data-i="' + i + '" aria-expanded="' + open + '">' +
        '<span class="pj-when"><b>' + (i === 0 ? 'Today' : r.year) + '</b>' + (age ? '<span>age ' + age + '</span>' : '') + (age && age === retire ? '<span class="tag">Retire</span>' : '') + '</span>' +
        '<b class="pj-nw">' + money0(r.net) + '</b>' + CHEV +
        '<span class="pj-bar">' + bar + '</span><span class="pj-dlt ' + (dlt < 0 ? 'neg' : 'pos') + '">' + (i ? signed(dlt) : '') + '</span></button>' + det + '</div>';
    }).join('');
    return '<div class="pj-phone">' + cmp + '<section class="card panel pj-years"><div class="panel-head"><h2>Year by year</h2><button class="btn sm" data-act="proj-csv">Export as CSV</button></div>' + list + '</section></div>';
  }
  function combinedOutputs() {
    var st = state.settings, sc = SCEN[st.scenario] || SCEN.base, t = totals(state);
    var rows = project(state).map(function (r) { return st.afterTax ? Object.assign({}, r, { stocks: r.stocks - r.taxStocks, k401: r.k401 - r.tax401, net: r.netAfter }) : r; });
    var last = rows[rows.length - 1], first = rows[0];
    var legend = [['var(--c-eq)', 'Home & vehicle equity'], ['var(--c-st)', 'Stocks & funds'], ['var(--c-k4)', '401(k)'], ['var(--c-cc)', 'CDs & cash']].map(function (l) { return '<span><i class="dot" style="--c:' + l[0] + '"></i>' + l[1] + '</span>'; }).join('');
    var mult = first.net > 0 ? (last.net / first.net).toFixed(1) + '× today’s ' + money0(first.net) : 'from ' + money0(first.net) + ' today';
    var tr = rows.map(function (r, i) {
      var dlt = i ? r.net - rows[i - 1].net : 0;
      return '<tr><td class="lead" data-label="When"><strong>' + (i === 0 ? 'Today' : r.year) + '</strong></td><td class="num" data-label="Stocks & funds">' + money0(r.stocks) + '</td><td class="num" data-label="401(k)">' + money0(r.k401) + '</td><td class="num" data-label="CDs & cash">' + money0(r.cds + r.cash) + '</td><td class="num" data-label="Home & vehicle">' + money0(r.assets) + '</td><td class="num neg" data-label="Loans">' + (r.mortgage > 0.5 ? '−' + money0(r.mortgage) : '$0') + '</td><td class="num" data-label="Net worth" style="font-weight:700">' + money0(r.net) + '</td><td class="num ' + (dlt < 0 ? 'neg' : 'pos') + '" data-label="Change">' + (i ? signed(dlt) : '—') + '</td></tr>';
    }).join('');
    return '<article class="card chart-card"><div class="chart-top"><div class="pv"><span>Projected net worth' + (st.afterTax ? ' after tax' : '') + ' in ' + last.year + (st.real ? ' · today’s dollars' : '') + '</span><b>' + money0(last.net) + '</b><span>' + esc(mult) + (st.afterTax ? '' : ' · ' + money0(last.netAfter) + ' after tax') + '</span>' + (st.afterTax && last.taxStocks + last.tax401 > 0.5 ? '<span class="pv-tax"><b>−' + money0(last.taxStocks + last.tax401) + '</b> estimated taxes if cashed out · ' + money0(last.taxStocks) + ' on stock gains, ' + money0(last.tax401) + ' on the 401(k)</span>' : '') + '</div>' +
      '<div><div class="eyebrow">' + sc.label + ' scenario</div><div class="c-legend">' + legend + '</div></div></div>' +
      '<div class="chart-scroll">' + stackedChart(rows) + '</div><p class="note">' + (st.afterTax ? 'Stocks and 401(k) are shown after the tax due if cashed out that year. ' : '') + 'Hover a column for its total. Illustrative model only; actual returns and values will vary.</p></article>' +
      projPhone(rows) +
      '<div class="kpis pj-desk"><div><span>Investments &amp; cash</span><b>' + money0(last.stocks + last.k401 + last.cds + last.cash) + '</b><small>Today ' + money0(t.investable) + '</small></div>' +
      '<div><span>Home &amp; vehicle</span><b>' + money0(last.assets) + '</b><small>Today ' + money0(t.assets) + '</small></div>' +
      '<div><span>Loans left</span><b class="neg">' + (last.mortgage > 0.5 ? money0(last.mortgage) : '$0') + '</b><small>Today ' + money0(t.mortgage) + '</small></div></div>' +
      '<section class="card panel pj-desk"><div class="panel-head"><h2>Year by year</h2><button class="btn sm" data-act="proj-csv">Export as CSV</button></div><div class="tablewrap"><table class="rt" style="min-width:700px"><thead><tr><th>When</th><th class="num">Stocks &amp; funds</th><th class="num">401(k)</th><th class="num">CDs &amp; cash</th><th class="num">Home &amp; vehicle</th><th class="num">Loans</th><th class="num">Net worth</th><th class="num">Change</th></tr></thead><tbody>' + tr + '</tbody></table></div></section>';
  }

  /* By account: one block each for stocks, 401(k), CDs and savings. */
  var BLOCKS = [
    { key: 'stocks', label: 'Stocks & funds', icon: 'projections', c: 'var(--c-st)', cum: 'cStocks', one: 'position' },
    { key: 'k401', label: '401(k)', icon: 'k401', c: 'var(--c-k4)', cum: 'cK401', one: 'account' },
    { key: 'cds', label: 'CDs', icon: 'cds', c: 'var(--c-cc)', cum: null, one: 'CD' },
    { key: 'cash', label: 'Savings & checking', icon: 'cash', c: 'var(--c-sv)', cum: 'cCash', one: 'account' }
  ];
  var MILESTONES = [1e4, 2.5e4, 5e4, 1e5, 2.5e5, 5e5, 1e6, 2e6, 5e6, 1e7, 2e7];
  // Money moving into (+) or out of (−) a block up to row r, beyond its own growth.
  function flowTo(b, r) {
    var f = b.cum ? r[b.cum] : 0;
    if (b.key === 'cash') f += r.cdToCash;
    if (b.key === 'cds') f -= r.cdToCash;
    return f;
  }
  function spark(vals, color) {
    var W = 600, H = 96, P = 4, mx = Math.max.apply(null, vals.concat([1]));
    var X = function (i) { return vals.length === 1 ? 0 : i * W / (vals.length - 1); };
    var Y = function (v) { return P + (H - 2 * P) * (1 - v / mx); };
    var line = vals.map(function (v, i) { return (i ? 'L' : 'M') + X(i).toFixed(1) + ',' + Y(v).toFixed(1); }).join(' ');
    return '<svg class="spark" viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="none" aria-hidden="true" style="--c:' + color + '">' +
      '<path class="sp-area" d="' + line + ' L' + W + ',' + H + ' L0,' + H + ' Z"/><path class="sp-line" d="' + line + '" vector-effect="non-scaling-stroke"/></svg>';
  }
  function renderBlock(b, rows) {
    var st = state.settings, sc = SCEN[st.scenario] || SCEN.base, list = state[b.key];
    var head = function (pill, sub) {
      return '<div class="blk-head"><span class="glyph">' + icon(b.icon) + '</span><div><h3>' + b.label + '</h3><span>' + sub + '</span></div>' + (pill ? '<span class="pill">' + pill + '</span>' : '') + '</div>';
    };
    if (!list.length) {
      return '<article class="card blk">' + head('', 'Nothing added yet') + '<p class="muted" style="margin:0;font-size:13px">Add ' + (b.key === 'stocks' ? 'a position on the <a href="#/stocks">Stocks</a> page' : 'one on the <a href="#/accounts" data-act="goto-tab" data-cat="' + b.key + '">Accounts</a> page') + ' to project it.</p></article>';
    }
    var first = rows[0], last = rows[rows.length - 1];
    var vals = rows.map(function (r) { return r[b.key]; });
    var start = vals[0], end = vals[vals.length - 1];
    var contrib = b.cum ? last[b.cum] : 0, fromCds = b.key === 'cash' ? last.cdToCash : 0, toCash = b.key === 'cds' ? last.cdToCash : 0;
    var growth = end - start - contrib - fromCds + toCash;
    var cg = n(st.contribGrowth);

    var rate, rateNote = '';
    if (b.key === 'stocks' || b.key === 'k401') {
      var base = n(b.key === 'stocks' ? st.stocksGrowth : st.k401Growth);
      rate = base + sc.mkt;
      if (sc.mkt) rateNote = pct(base) + ' base ' + (sc.mkt < 0 ? '−' : '+') + ' ' + Math.abs(sc.mkt) + ' for ' + sc.label;
    } else rate = wavg(list, b.key === 'cds' ? 'principal' : 'balance');
    var sub = list.length + ' ' + b.one + (list.length === 1 ? '' : 's') + (rateNote ? ' · ' + rateNote : '');

    var mult = b.key === 'cds' && end < 0.5 && toCash > 0.5 ? 'Moved to savings' : start > 0 && end >= 0.5 ? (end / start).toFixed(1) + '×' : '';
    var nums = '<div class="blk-nums"><div><span>Today</span><b class="sm">' + money0(start) + '</b></div><span class="arrow" aria-hidden="true">→</span>' +
      '<div><span>' + last.year + '</span><b>' + money0(end) + '</b></div>' + (mult ? '<span class="mult' + (end < start && end >= 0.5 ? ' down' : '') + '">' + mult + '</span>' : '') + '</div>';

    // Where the ending value comes from.
    var parts = [["Today's balance", start, 'color-mix(in srgb,' + b.c + ' 28%,var(--surface-soft))']];
    if (contrib > 0.5) parts.push(['Your contributions', contrib, 'color-mix(in srgb,' + b.c + ' 60%,var(--surface))']);
    if (fromCds > 0.5) parts.push(['From matured CDs', fromCds, 'var(--c-cc)']);
    if (growth > 0.5) parts.push([b.key === 'cds' || b.key === 'cash' ? 'Interest earned' : 'Investment growth', growth, b.c]);
    var whole = parts.reduce(function (a, p) { return a + p[1]; }, 0) || 1;
    var bar = '<div class="split" role="img" aria-label="' + esc(parts.map(function (p) { return p[0] + ' ' + money0(p[1]); }).join(', ')) + '">' +
      parts.map(function (p) { return '<span style="width:' + (p[1] / whole * 100).toFixed(2) + '%;background:' + p[2] + '"></span>'; }).join('') + '</div>';
    var legendRows = parts.map(function (p) { return '<div><i class="dot" style="--c:' + p[2] + '"></i><span>' + p[0] + '</span><b>' + money0(p[1]) + '</b><em>' + pct(p[1] / whole * 100, 0) + '</em></div>'; });
    if (growth < -0.5) legendRows.push('<div><i class="dot" style="--c:var(--neg)"></i><span>Lost to inflation</span><b class="neg">' + money0(growth) + '</b><em></em></div>');
    if (toCash > 0.5) legendRows.push('<div><i class="dot" style="--c:var(--c-eq)"></i><span>Moved to savings</span><b>' + money0(-toCash) + '</b><em></em></div>');

    var facts = [];
    var hit = MILESTONES.filter(function (m) { return m > start && m <= end; }).pop();
    if (hit) {
      var yr = rows.filter(function (r) { return r[b.key] >= hit; })[0];
      facts.push('Passes ' + short(hit) + ' in ' + yr.year + '.');
    }
    var growNote = cg ? ', rising ' + pct(cg) + ' a year' : '';
    if (b.key === 'stocks') facts.push('Adds ' + money0(n(st.stocksContrib)) + ' a year' + growNote + '. Every position grows at the same ' + pct(rate) + ' rate.');
    if (b.key === 'k401') facts.push('Adds ' + money0(list.reduce(function (a, r) { return a + n(r.contrib); }, 0)) + ' a year' + growNote + ', from your 401(k) entries.');
    if (b.key === 'cds') {
      if (st.cdMode === 'renew') facts.push('Each CD renews at its current APY when it matures.');
      else {
        var horizonEnd = new Date(); horizonEnd.setFullYear(horizonEnd.getFullYear() + rows.length - 1);
        var dates = list.map(function (r) { return parseDate(r.matures); }).filter(function (d) { return d && d <= horizonEnd; });
        if (dates.length) {
          var lastD = new Date(Math.max.apply(null, dates));
          facts.push((dates.length === list.length ? (list.length === 1 ? 'It matures' : 'All ' + list.length + ' mature') : dates.length + ' of ' + list.length + ' mature') + ' by ' + lastD.getFullYear() + ' and move to savings, where they earn the savings rate.');
        }
        var noDate = list.filter(function (r) { return !parseDate(r.matures); }).length;
        if (noDate) facts.push(noDate + ' without a maturity date ' + (noDate === 1 ? 'is' : 'are') + ' treated as renewing.');
      }
    }
    if (b.key === 'cash') {
      facts.push('Adds ' + money0(n(st.cashContrib)) + ' a year' + growNote + '. Grows at the balance-weighted APY of ' + pct(rate, 2) + '.');
      var best = Math.max.apply(null, list.map(function (r) { return n(r.apy); }));
      var low = list.filter(function (r) { return n(r.apy) < 1 && n(r.balance) > 0; });
      var lowBal = low.reduce(function (a, r) { return a + n(r.balance); }, 0);
      var gain = low.reduce(function (a, r) { return a + n(r.balance) * (best - n(r.apy)) / 100; }, 0);
      if (lowBal && best >= 1 && gain >= 50) facts.push('<strong>' + money0(lowBal) + ' earns under 1% APY.</strong> At your best rate of ' + pct(best, 2) + ' it would earn about ' + money0(gain) + ' more a year. Checking you spend from may need to stay where it is.');
    }

    var taxLine = '';
    if (b.key === 'stocks' || b.key === 'k401') {
      var tax = b.key === 'stocks' ? last.taxStocks : last.tax401;
      if (tax > 0.5) taxLine = '<div class="blk-tax"><span>After tax if cashed out in ' + last.year + '</span><b>' + money0(end - tax) + '</b><em>−' + money0(tax) + (b.key === 'stocks' ? ' on ' + money0(last.gainStocks) + ' of gains' : ' income tax on withdrawal') + '</em></div>';
    }
    var it = b.key === 'cash' ? last.intTaxCash : b.key === 'cds' ? last.intTaxCds : 0;
    if (it > 0.5) facts.push('Interest is shown after about ' + money0(it) + ' of income tax at ' + pct(taxRates(st).interest * 100) + ', paid year by year.');
    var trs = rows.slice(1).map(function (r, i) {
      var prev = rows[i], flow = flowTo(b, r) - flowTo(b, prev), g = r[b.key] - prev[b.key] - flow;
      return '<tr><td>' + r.year + '</td><td class="num">' + money0(r[b.key]) + '</td><td class="num">' + (Math.abs(flow) < 0.5 ? '—' : signed(flow)) + '</td><td class="num ' + (g < -0.5 ? 'neg' : '') + '">' + (Math.abs(g) < 0.5 ? '—' : signed(g)) + '</td></tr>';
    }).join('');
    var flowHead = b.key === 'cds' ? 'Moved out' : b.key === 'cash' ? 'Added' : 'Contributed';
    var open = ui.openYears[b.key] ? ' open' : '';

    return '<article class="card blk" style="--c:' + b.c + '">' + head(pct(rate, 2) + ' / yr', sub) + nums + taxLine + spark(vals, b.c) +
      '<div class="blk-split">' + bar + '<div class="split-legend">' + legendRows.join('') + '</div></div>' +
      (facts.length ? '<ul class="facts">' + facts.map(function (f) { return '<li>' + f + '</li>'; }).join('') + '</ul>' : '') +
      '<details data-blk="' + b.key + '"' + open + '><summary>Year by year</summary><div class="tablewrap"><table class="mini"><thead><tr><th>Year</th><th class="num">Value</th><th class="num">' + flowHead + '</th><th class="num">' + (b.key === 'stocks' || b.key === 'k401' ? 'Growth' : 'Interest') + '</th></tr></thead><tbody>' + trs + '</tbody></table></div></details>' +
      '</article>';
  }
  function blockOutputs() {
    var st = state.settings, sc = SCEN[st.scenario] || SCEN.base, rows = project(state), last = rows[rows.length - 1], first = rows[0];
    var keys = ['stocks', 'k401', 'cds', 'cash'];
    var sum = function (r) { return keys.reduce(function (a, k) { return a + r[k]; }, 0); };
    var contrib = last.cStocks + last.cK401 + last.cCash, startV = sum(first), endV = sum(last), growth = endV - startV - contrib;
    return '<article class="card chart-card"><div class="chart-top"><div class="pv"><span>Investments &amp; cash in ' + last.year + (st.real ? ' · today’s dollars' : '') + '</span><b>' + money0(endV) + '</b><span>From ' + money0(startV) + ' today · ' + money0(contrib) + ' contributed · ' + (growth < 0 ? money0(growth) + ' lost to inflation' : money0(growth) + ' growth and interest') + '</span></div>' +
      '<div><div class="eyebrow">' + sc.label + ' scenario</div></div></div>' + (last.taxStocks + last.tax401 > 0.5 ? '<p class="blk-tax-sum">After tax if everything were cashed out in ' + last.year + ': <b>' + money0(endV - last.taxStocks - last.tax401) + '</b></p>' : '') + '</article>' +
      '<div class="blocks">' + BLOCKS.map(function (b) { return renderBlock(b, rows); }).join('') + '</div>' +
      '<p class="note">Each block follows the assumptions on the left. Home, vehicle and loans are in the Combined view. Illustrative model only; actual returns will vary.</p>';
  }
  function scenNote() {
    var st = state.settings, sc = SCEN[st.scenario] || SCEN.base;
    return sc.label + ' adds ' + (sc.mkt >= 0 ? '+' : '−') + Math.abs(sc.mkt) + ' points to stock and 401(k) growth and ' + (sc.asset >= 0 ? '+' : '−') + Math.abs(sc.asset) + ' to asset growth. Savings use the accounts’ APY; ' + (st.cdMode === 'renew' ? 'CDs renew at their APY' : 'CDs earn their APY until maturity, then move to savings') + '. Loans follow their payment schedules. Investment fees are not included.';
  }
  function segBtns(act, cur, opts) {
    return opts.map(function (o) { return '<button type="button" data-act="' + act + '" data-val="' + o[0] + '" aria-pressed="' + (cur === o[0]) + '">' + o[1] + '</button>'; }).join('');
  }
  function taxSummary() {
    var r = taxRates(state.settings);
    return 'Taxes: ' + pct(r.cap * 100) + ' on stock gains, ' + pct(r.k401 * 100) + ' on 401(k) withdrawals, ' + pct(r.interest * 100) + ' on interest every year.';
  }
  var VIEW_OPTS = [['combined', 'Combined'], ['accounts', 'By account']];
  function renderProjections() {
    var st = state.settings;
    if (!ORDER.some(function (k) { return state[k].length; })) return '<header class="head"><div><div class="eyebrow">Projection lab</div><h1>Yearly projections</h1></div></header><div class="card empty">Add at least one account to see projections.</div>';
    var num = function (key, label, step) {
      return '<div class="cg"><div class="cl"><label for="s_' + key + '">' + label + '</label></div><input class="ni" id="s_' + key + '" type="number" step="' + step + '" inputmode="decimal" value="' + esc(n(st[key])) + '" data-set="' + key + '" data-fk="s_' + key + '"></div>';
    };
    var hz = Math.round(n(st.horizon)) || 15;
    return '<header class="head"><div><div class="eyebrow">Projection lab</div><h1 id="projH1">See the next ' + hz + ' years before they happen.</h1></div>' +
      '<div class="actions"><div class="seg seg-view" role="group" aria-label="Projection view">' + segBtns('projview', st.projView, VIEW_OPTS) + '</div><button class="btn" data-act="reset-proj">Reset assumptions</button></div></header>' +
      '<div class="proj"><aside class="card controls" aria-label="Projection assumptions"><h3>Assumptions</h3>' +
      '<div class="cg"><div class="cl"><span id="taxLab">Show values</span></div><div class="seg seg2" role="group" aria-labelledby="taxLab">' + segBtns('aftertax', st.afterTax ? 'after' : 'before', [['before', 'Before tax'], ['after', 'After tax']]) + '</div><p class="note" style="margin:8px 0 0">' + taxSummary() + ' <a href="#/settings">Change rates</a></p></div>' +
      '<div class="cg"><div class="cl"><span id="scenLab">Market scenario</span></div><div class="seg" role="group" aria-labelledby="scenLab">' + segBtns('scenario', st.scenario, Object.keys(SCEN).map(function (k) { return [k, SCEN[k].label]; })) + '</div></div>' +
      '<div class="cg"><div class="cl"><label for="s_horizon">Time horizon</label><b id="hzLab">' + hz + ' years</b></div><input id="s_horizon" type="range" min="1" max="40" step="1" value="' + hz + '" data-set="horizon"></div>' +
      num('stocksGrowth', 'Stocks &amp; funds growth (% / yr)', '0.1') + num('k401Growth', '401(k) growth (% / yr)', '0.1') +
      num('stocksContrib', 'Added to stocks each year ($)', '100') + num('cashContrib', 'Added to savings each year ($)', '100') +
      num('contribGrowth', 'Contributions rise each year (%)', '0.5') +
      '<div class="cg"><div class="cl"><span id="cdLab">When a CD matures</span></div><div class="seg seg2" role="group" aria-labelledby="cdLab">' + segBtns('cdmode', st.cdMode === 'renew' ? 'renew' : 'savings', [['savings', 'Move to savings'], ['renew', 'Renew']]) + '</div></div>' +
      '<div class="cg"><label class="check"><input type="checkbox" data-set="real"' + (st.real ? ' checked' : '') + '> Show in today’s dollars</label>' +
      '<div class="cl" style="margin-top:8px"><label for="s_inflation">Inflation (% / yr)</label></div><input class="ni" id="s_inflation" type="number" step="0.1" inputmode="decimal" value="' + esc(n(st.inflation)) + '" data-set="inflation"></div>' +
      '<p class="note" id="scenNote" style="margin:4px 0 0">' + scenNote() + '</p></aside>' +
      '<div class="proj-main" id="projOut">' + projOutputs() + '</div></div>';
  }
  // Controls stay put while you type or drag; only the results redraw.
  function refreshProjOutputs() {
    var out = $('#projOut'); if (!out) return;
    var st = state.settings;
    out.innerHTML = projOutputs();
    var hz = Math.round(n(st.horizon)) || 15;
    $('#hzLab').textContent = hz + ' years';
    $('#projH1').textContent = 'See the next ' + hz + ' years before they happen.';
    $('#scenNote').textContent = scenNote();
    var cur = { scenario: st.scenario, cdmode: st.cdMode === 'renew' ? 'renew' : 'savings', projview: st.projView, aftertax: st.afterTax ? 'after' : 'before' };
    document.querySelectorAll('.seg [data-act]').forEach(function (b) { if (b.dataset.act in cur) b.setAttribute('aria-pressed', String(b.dataset.val === cur[b.dataset.act])); });
  }

  /* ---------- insights ----------
     Five interactive views, all in today's dollars. The what-if explorer is a sandbox: nothing changes in your saved
     plan until you choose "Apply to my plan". Colors come from the validated categorical palette, in its slot order. */
  var CAT = [
    { key: 'assets', label: 'Property & assets', c: 'var(--c-eq)', on: 'var(--on-eq)' },
    { key: 'stocks', label: 'Stocks & funds', c: 'var(--c-st)', on: 'var(--on-st)' },
    { key: 'k401', label: '401(k)', c: 'var(--c-k4)', on: 'var(--on-k4)' },
    { key: 'cds', label: 'CDs', c: 'var(--c-cc)', on: 'var(--on-cc)' },
    { key: 'cash', label: 'Savings & checking', c: 'var(--c-sv)', on: 'var(--on-sv)' }
  ];
  function realState(over) { return Object.assign({}, state, { settings: Object.assign({}, state.settings, { real: true }, over || {}) }); }
  function ageDate(age0, age) { var d = new Date(); d.setMonth(d.getMonth() + Math.round((age - age0) * 12)); return d; }
  // Compact money for chart labels: full dollars under $1,000 so small changes don't read as $0K.
  function compact(v) { return Math.abs(v) < 1000 ? money0(v) : short(v); }
  function tipAttr(rows) { return ' data-tip="' + esc(JSON.stringify(rows)) + '"'; }

  // One shared tooltip. Built with textContent, so names typed into the app are never treated as HTML.
  var tipEl = null;
  function showTip(rows, x, y) {
    if (!rows || !rows.length) return;
    if (!tipEl) { tipEl = document.createElement('div'); tipEl.className = 'viz-tip'; document.body.appendChild(tipEl); }
    tipEl.textContent = '';
    rows.forEach(function (r, i) {
      var line = document.createElement('div'); line.className = i === 0 ? 'vt-head' : 'vt-row';
      if (i > 0) { var k = document.createElement('i'); if (r[2]) k.style.background = r[2]; else k.style.visibility = 'hidden'; line.appendChild(k); }
      var lab = document.createElement('span'); lab.textContent = r[0]; line.appendChild(lab);
      if (r[1] != null && r[1] !== '') { var v = document.createElement('b'); v.textContent = r[1]; line.appendChild(v); }
      tipEl.appendChild(line);
    });
    tipEl.style.display = 'block';
    var w = tipEl.offsetWidth, hh = tipEl.offsetHeight, px = x + 16, py = y + 16;
    if (px + w > innerWidth - 8) px = x - w - 16;
    if (px < 8) px = 8;
    if (py + hh > innerHeight - 8) py = y - hh - 16;
    if (py < 8) py = 8;
    tipEl.style.left = px + 'px'; tipEl.style.top = py + 'px';
  }
  function hideTip() {
    if (tipEl) tipEl.style.display = 'none';
    document.querySelectorAll('.xh-line').forEach(function (l) { l.style.display = 'none'; });
  }
  var XH = {};   // crosshair charts: id -> { W, xs, tip(i) }
  function xhAt(el, cx, cy) {
    var c = XH[el.getAttribute('data-xh')]; if (!c) return;
    var svg = el.ownerSVGElement, box = svg.getBoundingClientRect(), vx = (cx - box.left) / box.width * c.W, best = 0;
    for (var i = 1; i < c.xs.length; i++) if (Math.abs(c.xs[i] - vx) < Math.abs(c.xs[best] - vx)) best = i;
    var line = svg.querySelector('.xh-line');
    if (line) { line.setAttribute('x1', c.xs[best]); line.setAttribute('x2', c.xs[best]); line.style.display = 'block'; }
    showTip(c.tip(best), cx, cy);
  }
  function onPointer(e) {
    var t = e.target.closest ? e.target : null; if (!t) return;
    var xh = t.closest('[data-xh]'); if (xh) { xhAt(xh, e.clientX, e.clientY); return; }
    var tip = t.closest('[data-tip]');
    if (tip) { try { showTip(JSON.parse(tip.getAttribute('data-tip')), e.clientX, e.clientY); } catch (err) { /* ignore */ } return; }
    if (tipEl && tipEl.style.display === 'block') hideTip();
  }
  document.addEventListener('pointermove', onPointer);
  document.addEventListener('pointerdown', onPointer);
  document.addEventListener('focusin', function (e) {
    var tip = e.target.closest && e.target.closest('[data-tip]'); if (!tip) return;
    var b = tip.getBoundingClientRect();
    try { showTip(JSON.parse(tip.getAttribute('data-tip')), b.left + Math.min(b.width, 40), b.bottom); } catch (err) { /* ignore */ }
  });
  document.addEventListener('focusout', function (e) { if (e.target.closest && e.target.closest('[data-tip]')) hideTip(); });
  window.addEventListener('scroll', hideTip, { passive: true });

  // Line/area chart over age, with optional stacked layers, phase bands, markers and a target dot. Hover: crosshair + tooltip.
  function ageChart(id, rows, layers, o) {
    var nar = innerWidth < 680, W = nar ? 420 : 1000, H = nar ? Math.round((o.H || 300) * 0.9) : (o.H || 300), L = nar ? 46 : 64, R = nar ? 10 : 18, T = o.bands ? 34 : 18, B = 32;
    var a0 = rows[0].age, a1 = rows[rows.length - 1].age;
    var X = function (a) { return L + (a - a0) / ((a1 - a0) || 1) * (W - L - R); };
    var tops = rows.map(function (r) { return layers.reduce(function (s, l) { return s + Math.max(0, r[l.key] || 0); }, 0); });
    var extra = o.line ? rows.map(function (r) { return r[o.line.key] || 0; }) : [];
    var mx = Math.max.apply(null, tops.concat(extra).concat(o.target ? [o.target.value] : []).concat([1]));
    var step = niceStep(mx / 4), top = Math.ceil(mx / step) * step;
    var Y = function (v) { return T + (H - T - B) * (1 - v / top); };
    var out = '';
    (o.bands || []).forEach(function (b, i) {
      if (b.to <= b.from) return;
      var x0 = X(b.from), x1 = X(b.to);
      if (i % 2 === 1) out += '<rect class="band" x="' + x0.toFixed(1) + '" y="' + T + '" width="' + (x1 - x0).toFixed(1) + '" height="' + (H - T - B) + '"/>';
      if (x1 - x0 > b.label.length * 6.4 + 10) out += '<text class="band-lab" x="' + (x0 + 6).toFixed(1) + '" y="' + (T - 10) + '">' + esc(b.label) + '</text>';
    });
    for (var g = 0; g <= top + 1; g += step) {
      out += '<line class="grid" x1="' + L + '" x2="' + (W - R) + '" y1="' + Y(g).toFixed(1) + '" y2="' + Y(g).toFixed(1) + '"/><text class="ax" x="' + (L - 8) + '" y="' + (Y(g) + 4).toFixed(1) + '" text-anchor="end">' + short(g) + '</text>';
    }
    var lower = rows.map(function () { return 0; });
    layers.forEach(function (l) {
      var upper = rows.map(function (r, i) { return lower[i] + Math.max(0, r[l.key] || 0); });
      var topPath = rows.map(function (r, i) { return (i ? 'L' : 'M') + X(r.age).toFixed(1) + ',' + Y(upper[i]).toFixed(1); }).join(' ');
      var back = rows.slice().reverse().map(function (r, j) { var i = rows.length - 1 - j; return 'L' + X(r.age).toFixed(1) + ',' + Y(lower[i]).toFixed(1); }).join(' ');
      if (layers.length === 1) {
        out += '<path d="' + topPath + ' ' + back + ' Z" style="fill:' + l.c + ';opacity:.12"/><path d="' + topPath + '" style="fill:none;stroke:' + l.c + ';stroke-width:2;stroke-linejoin:round"/>';
      } else {
        out += '<path d="' + topPath + ' ' + back + ' Z" style="fill:' + l.c + '"/><path d="' + topPath + '" style="fill:none;stroke:var(--surface);stroke-width:2"/>';
      }
      lower = upper;
    });
    if (o.line) {
      var lp = rows.map(function (r, i) { return (i ? 'L' : 'M') + X(r.age).toFixed(1) + ',' + Y(r[o.line.key] || 0).toFixed(1); }).join(' ');
      out += '<path d="' + lp + '" style="fill:none;stroke:var(--muted);stroke-width:2;stroke-linejoin:round"/>';
    }
    (o.markers || []).forEach(function (m, i) {
      if (m.age < a0 || m.age > a1) return;
      var x = X(m.age);
      out += '<line class="mk-line" x1="' + x.toFixed(1) + '" x2="' + x.toFixed(1) + '" y1="' + T + '" y2="' + (H - B) + '"/>';
      out += '<text class="mk-lab" x="' + (x + 5).toFixed(1) + '" y="' + (T + 14 + i * 15) + '">' + esc(m.label) + '</text>';
    });
    if (o.target && o.target.age >= a0 && o.target.age <= a1) {
      var tx = X(o.target.age), ty = Y(o.target.value);
      out += '<line class="tgt-line" x1="' + (tx - 34).toFixed(1) + '" x2="' + (tx + 34).toFixed(1) + '" y1="' + ty.toFixed(1) + '" y2="' + ty.toFixed(1) + '"/>' +
        '<circle cx="' + tx.toFixed(1) + '" cy="' + ty.toFixed(1) + '" r="5" class="tgt-dot"/>' +
        '<text class="mk-lab" x="' + (tx + 8).toFixed(1) + '" y="' + (ty + 20).toFixed(1) + '">' + esc(o.target.label) + '</text>';
    }
    var every = nar ? 10 : (Math.max(1, Math.round((a1 - a0) / 9 / 5) * 5) || 5);
    for (var a = Math.ceil(a0 / 5) * 5; a <= a1; a += every) out += '<text class="ax" x="' + X(a).toFixed(1) + '" y="' + (H - 10) + '" text-anchor="middle">' + a + '</text>';
    out += '<text class="ax" x="' + (L - 8) + '" y="' + (H - 10) + '" text-anchor="end">Age</text>';
    out += '<line class="xh-line" x1="0" x2="0" y1="' + T + '" y2="' + (H - B) + '"/>';
    out += '<rect class="xh-hit" data-xh="' + id + '" x="' + L + '" y="' + T + '" width="' + (W - L - R) + '" height="' + (H - T - B) + '"/>';
    XH[id] = { W: W, xs: rows.map(function (r) { return X(r.age); }), tip: o.tip };
    return '<svg class="age-chart" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="' + esc(o.aria) + '" style="width:100%;height:auto;display:block">' + out + '</svg>';
  }
  function legend(items) {
    return '<div class="viz-legend">' + items.map(function (it) { return '<span><i class="' + (it.line ? 'lk-line' : 'lk-area') + '" style="--c:' + it.c + '"></i>' + esc(it.label) + '</span>'; }).join('') + '</div>';
  }

  /* Chance of success (Monte Carlo) display helpers. */
  function mcPct(x) { return x >= 0.995 ? 'Over 99%' : x < 0.005 ? 'Under 1%' : Math.round(x * 100) + '%'; }
  function mcCls(x) { return x >= 0.85 ? 'pos' : x >= 0.7 ? 'mc-mid' : 'neg'; }
  function mcLine(s) {
    var mc = monteCarlo(s || state);
    return '<a class="mc-line" href="#/insights"><b class="' + mcCls(mc.success) + '">' + mcPct(mc.success) + '</b> chance the money lasts to ' + mc.endAge + ', with market ups and downs ›</a>';
  }
  // Fan chart: the middle 80% and middle 50% of simulated futures as shaded bands, the typical (median) future as a line,
  // and the steady-returns plan as a dashed line for comparison.
  function fanChart(id, rows, o) {
    var nar = innerWidth < 680, W = nar ? 420 : 1000, H = nar ? 280 : 320, L = nar ? 46 : 64, R = nar ? 10 : 18, T = 18, B = 32;
    var a0 = rows[0].age, a1 = rows[rows.length - 1].age;
    var X = function (a) { return L + (a - a0) / ((a1 - a0) || 1) * (W - L - R); };
    var mx = Math.max.apply(null, rows.map(function (r) { return Math.max(r.p90, r.plan || 0); }).concat([1]));
    var step = niceStep(mx / 4), top = Math.ceil(mx / step) * step;
    var Y = function (v) { return T + (H - T - B) * (1 - Math.max(0, v) / top); };
    var line = function (k) { return rows.map(function (r, i) { return (i ? 'L' : 'M') + X(r.age).toFixed(1) + ',' + Y(r[k]).toFixed(1); }).join(' '); };
    var band = function (lo, hi) { return line(hi) + ' ' + rows.slice().reverse().map(function (r) { return 'L' + X(r.age).toFixed(1) + ',' + Y(r[lo]).toFixed(1); }).join(' ') + ' Z'; };
    var out = '';
    for (var g = 0; g <= top + 1; g += step) out += '<line class="grid" x1="' + L + '" x2="' + (W - R) + '" y1="' + Y(g).toFixed(1) + '" y2="' + Y(g).toFixed(1) + '"/><text class="ax" x="' + (L - 8) + '" y="' + (Y(g) + 4).toFixed(1) + '" text-anchor="end">' + short(g) + '</text>';
    out += '<path d="' + band('p10', 'p90') + '" class="fan-outer"/><path d="' + band('p25', 'p75') + '" class="fan-inner"/>';
    out += '<path d="' + line('plan') + '" class="fan-plan"/><path d="' + line('p50') + '" class="fan-mid"/>';
    (o.markers || []).forEach(function (m, i) {
      if (m.age < a0 || m.age > a1) return;
      var x = X(m.age);
      out += '<line class="mk-line" x1="' + x.toFixed(1) + '" x2="' + x.toFixed(1) + '" y1="' + T + '" y2="' + (H - B) + '"/><text class="mk-lab" x="' + (x + 5).toFixed(1) + '" y="' + (T + 14 + i * 15) + '">' + esc(m.label) + '</text>';
    });
    var every = nar ? 10 : (Math.max(1, Math.round((a1 - a0) / 9 / 5) * 5) || 5);
    for (var a = Math.ceil(a0 / 5) * 5; a <= a1; a += every) out += '<text class="ax" x="' + X(a).toFixed(1) + '" y="' + (H - 10) + '" text-anchor="middle">' + a + '</text>';
    out += '<text class="ax" x="' + (L - 8) + '" y="' + (H - 10) + '" text-anchor="end">Age</text>';
    out += '<line class="xh-line" x1="0" x2="0" y1="' + T + '" y2="' + (H - B) + '"/><rect class="xh-hit" data-xh="' + id + '" x="' + L + '" y="' + T + '" width="' + (W - L - R) + '" height="' + (H - T - B) + '"/>';
    XH[id] = { W: W, xs: rows.map(function (r) { return X(r.age); }), tip: o.tip };
    return '<svg class="age-chart" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="' + esc(o.aria) + '" style="width:100%;height:auto;display:block">' + out + '</svg>';
  }

  /* 1. Retirement what-if (sandbox) */
  function wiDefaults() {
    var st = state.settings;
    return { extra: 0, retire: Math.round(n(st.goalRetireAge)) || 65, claim: Math.round(n(st.ssClaimAge)) || 67, spend: Math.round(n(st.goalMonthly)), scenario: st.scenario };
  }
  function wiOver(w) { return { stocksContrib: n(state.settings.stocksContrib) + w.extra * 12, goalRetireAge: w.retire, ssClaimAge: w.claim, goalMonthly: w.spend, scenario: w.scenario }; }
  function wiFmt(k, v) { return k === 'extra' ? '+' + money0(v) + ' / mo' : k === 'spend' ? money0(v) + ' / mo' : 'Age ' + v; }
  function wiSlider(k, label, min, max, step) {
    var v = ui.whatIf[k];
    return '<div class="cg"><div class="cl"><label for="wi_' + k + '">' + label + '</label><b id="wiv_' + k + '">' + wiFmt(k, v) + '</b></div>' +
      '<input type="range" id="wi_' + k + '" min="' + min + '" max="' + max + '" step="' + step + '" value="' + v + '" data-wi="' + k + '" data-fk="wi_' + k + '"></div>';
  }
  function leverList(w) {
    var st = state.settings, base = goalStatus(realState(wiOver(w))), out = [];
    var test = function (label, ch) {
      var g = goalStatus(realState(Object.assign(wiOver(w), ch(wiOver(w)))));
      if (g.ok) out.push({ label: label, gain: base.gap - g.gap });
    };
    test('Add $500 a month to investments', function (o) { return { stocksContrib: o.stocksContrib + 6000 }; });
    test('Add $1,000 a month to investments', function (o) { return { stocksContrib: o.stocksContrib + 12000 }; });
    test('Retire 2 years later', function (o) { return { goalRetireAge: o.goalRetireAge + 2 }; });
    if (n(st.ssBenefit) > 0 && w.claim < 70) test('Start Social Security at 70', function () { return { ssClaimAge: 70 }; });
    if (w.spend > 1000) test('Spend $1,000 a month less', function (o) { return { goalMonthly: o.goalMonthly - 1000 }; });
    return { base: base, levers: out.sort(function (a, b) { return b.gain - a.gain; }) };
  }
  function leverChart(lv) {
    var nar = innerWidth < 680, W = nar ? 420 : 1000, rowH = nar ? 50 : 38, L = nar ? 0 : 300, R = nar ? 120 : 190, H = lv.levers.length * rowH + 8;
    var mx = Math.max.apply(null, lv.levers.map(function (l) { return Math.abs(l.gain); }).concat([1]));
    var out = '';
    lv.levers.forEach(function (l, i) {
      var y = 4 + i * rowH + (nar ? 20 : 0), bh = nar ? 18 : 22, w = Math.max(2, Math.abs(l.gain) / mx * (W - L - R)), x0 = L;
      var closes = lv.base.gap > 0 && l.gain >= lv.base.gap;
      var tip = [[l.label], [lv.base.gap > 0 ? 'Closes' : 'Adds to your cushion', money0(l.gain), 'var(--div-pos)']];
      if (lv.base.gap > 0) tip.push(['Gap left', closes ? 'None, on track' : money0(lv.base.gap - l.gain)]);
      out += '<g class="lever" tabindex="0" role="img" aria-label="' + esc(l.label + ': ' + money0(l.gain)) + '"' + tipAttr(tip) + '>' +
        '<rect x="0" y="' + (nar ? y - 20 : y) + '" width="' + W + '" height="' + rowH + '" fill="transparent"/>' +
        '<text class="lever-lab" x="0" y="' + (nar ? y - 6 : y + bh / 2 + 5) + '">' + esc(l.label) + '</text>' +
        '<path class="lever-bar" d="M' + x0 + ',' + y + ' h' + Math.max(0, w - 4).toFixed(1) + ' q4,0 4,4 v' + (bh - 8) + ' q0,4 -4,4 h-' + Math.max(0, w - 4).toFixed(1) + ' Z"/>' +
        '<text class="lever-val" x="' + (x0 + w + 8).toFixed(1) + '" y="' + (y + bh / 2 + 5) + '">' + compact(l.gain) + (closes ? ' · closes it' : '') + '</text></g>';
    });
    return '<svg viewBox="0 0 ' + W + ' ' + H + '" role="group" aria-label="How much each change helps" style="width:100%;height:auto;display:block">' + out + '</svg>';
  }
  function wiOutputs() {
    var w = ui.whatIf, sb = realState(wiOver(w)), g = goalStatus(sb);
    if (!g.ok) return '<div class="empty">Set your current age, retirement age and retirement income in <a href="#/settings">Settings</a> first.</div>';
    var p = lifePlan(sb), pb = lifePlan(realState()), mc = monteCarlo(sb);
    var byAge = {}; pb.rows.forEach(function (r) { byAge[r.age] = r.total; });
    var rows = p.rows.map(function (r) { return { age: r.age, year: r.year, total: r.total, base: byAge[r.age] != null ? byAge[r.age] : null }; });
    var on = g.gap <= 0, lv = leverList(w);
    var stats = '<div class="ins-stats"><div><span>Retirement goal at ' + w.retire + '</span><b class="' + (on ? 'pos' : 'neg') + '">' + (on ? 'On track' : 'Short ' + short(g.gap)) + '</b><em>' + money0(g.after) + ' of ' + money0(g.target) + ' needed</em></div>' +
      '<div><span>Chance it lasts to ' + p.endAge + '</span><b class="' + mcCls(mc.success) + '">' + mcPct(mc.success) + '</b><em>With steady returns: ' + (p.ranOut ? 'runs out at ' + p.ranOut : 'lasts past ' + p.endAge) + '</em></div>' +
      '<div><span>Supports in retirement</span><b>' + money0(g.incomeToday / 12) + ' / mo</b><em>Goal ' + money0(w.spend) + ' / mo at a ' + pct(g.rate * 100) + ' withdrawal rate</em></div></div>';
    var markers = [{ age: w.retire, label: 'Retire ' + w.retire }];
    if (p.ssStart !== null && p.ssStart !== w.retire) markers.push({ age: p.ssStart, label: 'Social Security ' + Math.round(p.ssStart) });
    var chart = ageChart('wiChart', rows, [{ key: 'total', label: 'What-if', c: 'var(--c-eq)' }], {
      H: 290, aria: 'Savings by age under the what-if settings, compared with your current plan', line: { key: 'base' }, markers: markers,
      target: { age: w.retire, value: g.target, label: 'Needed ' + short(g.target) },
      tip: function (i) {
        var r = rows[i], t = [['Age ' + r.age + ' · ' + r.year], ['What-if', money0(r.total), 'var(--c-eq)']];
        if (r.base != null) t.push(['Current plan', money0(r.base), 'var(--muted)']);
        return t;
      }
    });
    return stats + legend([{ label: 'What-if savings (investments and cash)', c: 'var(--c-eq)' }, { label: 'Your current plan', c: 'var(--muted)', line: true }]) + chart +
      '<h3 class="ins-h3">What helps most</h3><p class="note" style="margin:0 0 8px">' + (g.gap > 0 ? 'How much of the ' + money0(g.gap) + ' gap each change would close, one at a time.' : 'How much extra cushion each change would add, one at a time.') + '</p>' +
      (lv.levers.length ? leverChart(lv) : '<p class="muted">No changes to compare.</p>');
  }
  function insightsWhatIf() {
    if (!ui.whatIf) ui.whatIf = wiDefaults();
    var w = ui.whatIf, st = state.settings, age0 = Math.round(n(st.goalAge)) || 50;
    var scen = Object.keys(SCEN).map(function (k) { return '<button type="button" data-act="wi-scen" data-val="' + k + '" aria-pressed="' + (w.scenario === k) + '">' + SCEN[k].label + '</button>'; }).join('');
    var changed = JSON.stringify(w) !== JSON.stringify(wiDefaults());
    return '<div class="card ins-card wi-grid"><div class="wi-controls">' +
      wiSlider('extra', 'Add to investments', 0, 5000, 100) +
      wiSlider('retire', 'Retire at', age0 + 1, Math.max(75, w.retire), 1) +
      (n(st.ssBenefit) > 0 ? wiSlider('claim', 'Start Social Security at', 62, 70, 1) : '') +
      wiSlider('spend', 'Spending in retirement', 1000, Math.max(40000, w.spend), 250) +
      '<div class="cg"><div class="cl"><span id="wiScenLab">Markets</span></div><div class="seg" role="group" aria-labelledby="wiScenLab">' + scen + '</div></div>' +
      '<div class="actions"><button class="btn" data-act="wi-reset"' + (changed ? '' : ' disabled') + '>Reset</button><button class="btn primary" data-act="wi-apply"' + (changed ? '' : ' disabled') + '>Apply to my plan</button></div>' +
      '<p class="note">Try changes here freely. Your saved plan only changes when you choose Apply.</p></div>' +
      '<div class="wi-out" id="wiOut">' + wiOutputs() + '</div></div>';
  }
  function refreshWhatIf() {
    var out = $('#wiOut'); if (!out) return;
    out.innerHTML = wiOutputs();
    Object.keys(ui.whatIf).forEach(function (k) { var b = $('#wiv_' + k); if (b) b.textContent = wiFmt(k, ui.whatIf[k]); });
    var changed = JSON.stringify(ui.whatIf) !== JSON.stringify(wiDefaults());
    document.querySelectorAll('[data-act="wi-reset"],[data-act="wi-apply"]').forEach(function (b) { b.disabled = !changed; });
    document.querySelectorAll('[data-act="wi-scen"]').forEach(function (b) { b.setAttribute('aria-pressed', String(b.dataset.val === ui.whatIf.scenario)); });
  }

  /* 2. Will the money last? */
  function insightsLast() {
    var rs = realState(), g = goalStatus(rs);
    if (!g.ok) return '<div class="card ins-card empty">Set your ages and retirement income in <a href="#/settings">Settings</a> to see this.</div>';
    var p = lifePlan(rs), rows = p.rows, ss = p.ssStart, hasSS = ss !== null;
    var bands = [{ from: p.age0, to: p.R, label: 'Working' }];
    if (hasSS && ss > p.R) bands.push({ from: p.R, to: ss, label: 'Retired, before Social Security' });
    bands.push({ from: hasSS ? Math.max(p.R, ss) : p.R, to: p.endAge, label: hasSS ? 'With Social Security' : 'Retired' });
    var layers = [{ key: 'stocks', label: 'Stocks & funds', c: 'var(--c-st)' }, { key: 'k401', label: '401(k)', c: 'var(--c-k4)' }, { key: 'cash', label: 'Cash & CDs', c: 'var(--c-cc)' }];
    var peak = rows.reduce(function (a, r) { return r.total > a.total ? r : a; }, rows[0]);
    var markers = [{ age: p.R, label: 'Retire ' + p.R }];
    if (hasSS && ss !== p.R) markers.push({ age: ss, label: 'Social Security ' + Math.round(ss) });
    if (p.ranOut) markers.push({ age: p.ranOut, label: 'Runs out ' + p.ranOut });
    var chart = ageChart('lastChart', rows, layers, {
      H: 320, bands: bands, markers: markers, aria: 'Savings by account type from today to age ' + p.endAge + ', in today’s dollars',
      tip: function (i) {
        var r = rows[i], t = [['Age ' + r.age + ' · ' + r.year + (r.phase === 'work' ? ' · working' : r.phase === 'bridge' ? ' · before Social Security' : ' · retired')]];
        layers.forEach(function (l) { t.push([l.label, money0(r[l.key]), l.c]); });
        t.push(['Total', money0(r.total)]);
        if (r.phase !== 'work') {
          t.push(['Spending', money0(r.spend / 12) + ' / mo']);
          if (r.income) t.push(['Guaranteed income', money0(r.income / 12) + ' / mo']);
          t.push(['From savings', money0(r.fromSavings / 12) + ' / mo']);
          if (r.short > 1) t.push(['Not covered', money0(r.short / 12) + ' / mo']);
        }
        return t;
      }
    });
    var mc = monteCarlo(rs), view = ui.lastView === 'accounts' ? 'accounts' : 'range';
    var stats = '<div class="ins-stats"><div><span>Chance it lasts to ' + p.endAge + '</span><b class="' + mcCls(mc.success) + '">' + mcPct(mc.success) + '</b><em>Of ' + mc.paths.toLocaleString('en-US') + ' simulated markets' + (mc.worst10 ? '; in the worst 10% it runs out by ' + mc.worst10 : '; even the worst 10% last') + '</em></div>' +
      '<div><span>With steady returns</span><b class="' + (p.ranOut ? 'neg' : 'pos') + '">' + (p.ranOut ? 'Runs out at ' + p.ranOut : 'Lasts past ' + p.endAge) + '</b><em>Peak ' + money0(peak.total) + ' at age ' + peak.age + (p.ranOut ? '' : ' · ' + money0(p.end) + ' left at ' + p.endAge) + '</em></div>' +
      '<div><span>Spending in retirement</span><b>' + money0(p.spend / 12) + ' / mo</b><em>' + (p.streams.length ? money0(p.streams.reduce(function (a, x) { return a + x.net; }, 0)) + ' / mo guaranteed once all income starts' : 'No guaranteed income entered') + '</em></div></div>';
    var table = '<details class="tbl"><summary>Show as a table</summary><div class="tablewrap"><table><thead><tr><th>Age</th><th>Year</th><th class="num">Stocks</th><th class="num">401(k)</th><th class="num">Cash &amp; CDs</th><th class="num">Total</th><th class="num">From savings / yr</th><th class="num">Guaranteed / yr</th></tr></thead><tbody>' +
      rows.map(function (r) { return '<tr><td>' + r.age + '</td><td>' + r.year + '</td><td class="num">' + money0(r.stocks) + '</td><td class="num">' + money0(r.k401) + '</td><td class="num">' + money0(r.cash) + '</td><td class="num">' + money0(r.total) + '</td><td class="num">' + (r.phase === 'work' ? '—' : money0(r.fromSavings)) + '</td><td class="num">' + (r.income ? money0(r.income) : '—') + '</td></tr>'; }).join('') +
      '</tbody></table></div></details>';
    var seg = '<div class="seg seg-view ins-seg" role="group" aria-label="Chart view"><button type="button" data-act="last-view" data-val="range" aria-pressed="' + (view === 'range') + '">Range of outcomes</button><button type="button" data-act="last-view" data-val="accounts" aria-pressed="' + (view === 'accounts') + '">By account</button></div>';
    var planBy = {}; rows.forEach(function (r) { planBy[r.age] = r.total; });
    var fanRows = mc.rows.map(function (r) { return Object.assign({}, r, { plan: planBy[r.age] != null ? planBy[r.age] : 0, year: new Date().getFullYear() + (r.age - p.age0) }); });
    var fan = fanChart('fanChart', fanRows, {
      markers: markers.filter(function (m) { return !/^Runs out/.test(m.label); }), aria: 'Range of savings by age across ' + mc.paths + ' simulated markets, in today’s dollars',
      tip: function (i) {
        var r = fanRows[i];
        return [['Age ' + r.age + ' · ' + r.year], ['Best 10% of futures', 'over ' + money0(r.p90), 'var(--c-eq)'], ['Typical future', money0(r.p50), 'var(--c-eq)'], ['Worst 10% of futures', 'under ' + money0(r.p10), 'var(--c-eq)'],
          ['Steady returns', money0(r.plan), 'var(--muted)'], ['Still covering spending', mcPct(r.alive)]];
      }
    });
    var fanLegend = '<div class="viz-legend"><span><i class="lk-area" style="--c:var(--c-eq);opacity:.35"></i>Middle 80% of futures</span><span><i class="lk-area" style="--c:var(--c-eq);opacity:.7"></i>Middle 50%</span><span><i class="lk-line" style="--c:var(--c-eq)"></i>Typical future</span><span><i class="lk-line lk-dash" style="--c:var(--muted)"></i>Steady returns</span></div>';
    var body = view === 'range'
      ? fanLegend + fan + '<p class="note">Each simulated market gives every year a random return: on average your Projections growth rates, but with ups and downs of about ' + pct(n(state.settings.mcVolStocks), 0) + ' a year for stocks and ' + pct(n(state.settings.mcVol401), 0) + ' for the 401(k) (change them in <a href="#/settings">Settings</a>). The typical future follows your steady plan; the bands show good and bad luck around it. A stress test, not a forecast.</p>'
      : legend(layers) + chart;
    return '<div class="card ins-card">' + stats + seg + body +
      '<p class="note">Today’s dollars. Spending comes from cash and CDs first, then stocks (paying capital-gains tax on the gain), then the 401(k) (paying income tax). Returns follow your Projections settings and scenario; home equity isn’t used. The retirement goal uses the ' + pct(g.rate * 100) + ' rule instead, so the two can differ.</p>' + table + '</div>';
  }

  /* 3. Everything you own (treemap) */
  function tmItems() {
    var t = [];
    state.assets.forEach(function (r) { t.push({ id: r.id, cat: 'assets', name: r.name, v: n(r.value) }); });
    state.stocks.forEach(function (r) { if (priced(r)) { var v = n(r.qty) * n(r.price), c = n(r.qty) * n(r.cost); t.push({ id: r.id, cat: 'stocks', name: r.ticker, sub: r.company, v: v, gain: c ? (v - c) / c * 100 : null, gainV: v - c }); } });
    state.k401.forEach(function (r) { t.push({ id: r.id, cat: 'k401', name: r.name, v: n(r.balance) }); });
    state.cds.forEach(function (r) { t.push({ id: r.id, cat: 'cds', name: r.name, v: cdValueNow(r) }); });
    state.cash.forEach(function (r) { t.push({ id: r.id, cat: 'cash', name: r.name, v: n(r.balance) }); });
    return t.filter(function (x) { return x.v > 0.5; });
  }
  // Squarified treemap layout (Bruls et al.): rows of tiles kept as close to square as possible.
  function squarify(items, x, y, w, h) {
    var total = items.reduce(function (a, i) { return a + i.v; }, 0), out = [];
    if (!total || w <= 0 || h <= 0) return out;
    var rest = items.map(function (i) { return { it: i, a: i.v / total * w * h }; });
    var worst = function (row, side) {
      var s = row.reduce(function (a, r) { return a + r.a; }, 0), mx = Math.max.apply(null, row.map(function (r) { return r.a; })), mn = Math.min.apply(null, row.map(function (r) { return r.a; }));
      return Math.max(side * side * mx / (s * s), (s * s) / (side * side * mn));
    };
    while (rest.length) {
      var side = Math.min(w, h), row = [rest.shift()];
      while (rest.length && worst(row.concat([rest[0]]), side) <= worst(row, side)) row.push(rest.shift());
      var s = row.reduce(function (a, r) { return a + r.a; }, 0), off = 0;
      if (w >= h) { var cw = s / h; row.forEach(function (r) { var rh = r.a / cw; out.push({ it: r.it, x: x, y: y + off, w: cw, h: rh }); off += rh; }); x += cw; w -= cw; }
      else { var rh2 = s / w; row.forEach(function (r) { var rw = r.a / rh2; out.push({ it: r.it, x: x + off, y: y, w: rw, h: rh2 }); off += rw; }); y += rh2; h -= rh2; }
    }
    return out;
  }
  function gainFill(gp) {
    if (gp == null) return { fill: 'var(--div-mid)', ink: 'var(--ink)' };
    var t = Math.min(1, Math.abs(gp) / 50);
    return { fill: 'color-mix(in srgb,' + (gp >= 0 ? 'var(--div-pos)' : 'var(--div-neg)') + ' ' + Math.round(12 + 88 * t) + '%,var(--div-mid))', ink: t > 0.55 ? '#fff' : 'var(--ink)' };
  }
  function insightsTreemap() {
    var mode = ui.tmMode || 'cat', zoom = ui.tmZoom || 'all', narrow = innerWidth < 680;
    var items = tmItems(), t = totals(state), finds = concFindings(state);
    if (!items.length) return '<div class="card ins-card empty">Add accounts to see them here.</div>';
    // A selected concentration finding highlights its blocks and dims the rest; zoom out so they're all in view.
    var focus = finds.filter(function (f) { return f.key === ui.concFocus; })[0], focusIds = focus ? focus.ids : null;
    if (focus) zoom = 'all';
    var cats = CAT.map(function (c) { var its = items.filter(function (i) { return i.cat === c.key; }).sort(function (a, b) { return b.v - a.v; }); return Object.assign({}, c, { items: its, total: its.reduce(function (a, i) { return a + i.v; }, 0) }); }).filter(function (c) { return c.total > 0; });
    if (zoom !== 'all' && !cats.some(function (c) { return c.key === zoom; })) zoom = 'all';
    var shown = zoom === 'all' ? cats : cats.filter(function (c) { return c.key === zoom; });
    var grand = shown.reduce(function (a, c) { return a + c.total; }, 0), all = cats.reduce(function (a, c) { return a + c.total; }, 0);
    var W = narrow ? 600 : 1000, H = narrow ? 820 : 520, fs = narrow ? 21 : 13, head = narrow ? 40 : 26, out = '', off = 0;
    shown.forEach(function (c) {
      var size = c.total / grand * (narrow ? H : W);
      var sx = narrow ? 0 : off, sy = narrow ? off : 0, sw = narrow ? W : size, sh = narrow ? size : H;
      off += size;
      var hasHead = (narrow ? sh : sh) > head + 20 && sw > 90;
      if (hasHead) {
        var title = c.label + ' · ' + short(c.total);
        var fits = title.length * fs * 0.58 < sw - 10;
        out += '<text class="tm-head" x="' + (sx + 4).toFixed(1) + '" y="' + (sy + head * 0.68).toFixed(1) + '" style="font-size:' + fs + 'px">' + esc(fits ? title : c.label.length * fs * 0.58 < sw - 10 ? c.label : '') + '</text>';
      }
      var tiles = squarify(c.items, sx, sy + (hasHead ? head : 0), sw, sh - (hasHead ? head : 0));
      tiles.forEach(function (tl) {
        var it = tl.it, col = mode === 'gain' ? (it.cat === 'stocks' ? gainFill(it.gain) : gainFill(null)) : { fill: c.c, ink: c.on };
        var rw = Math.max(0, tl.w - 2), rh = Math.max(0, tl.h - 2);
        var tip = [[it.name + (it.sub ? ' · ' + it.sub : '')], [c.label, money0(it.v), c.c], ['Share of everything you own', pct(it.v / all * 100)]];
        if (it.cat === 'stocks' && it.gain != null) tip.push(['Gain / loss', signed(it.gainV) + ' (' + sgnPct(it.gain) + ')', it.gain >= 0 ? 'var(--div-pos)' : 'var(--div-neg)']);
        var label = '', name = it.name, val = short(it.v), lfs = Math.min(fs, Math.max(narrow ? 16 : 11, Math.min(rw, rh) / 4));
        var line2 = val + (mode === 'gain' && it.gain != null ? ' · ' + sgnPct(it.gain) : '');
        if (rw > Math.max(name.length, line2.length) * lfs * 0.6 + 12 && rh > lfs * 2.8) label = '<text x="' + (tl.x + 7).toFixed(1) + '" y="' + (tl.y + lfs + 6).toFixed(1) + '" style="font-size:' + lfs.toFixed(1) + 'px;font-weight:600;fill:' + col.ink + '">' + esc(name) + '</text><text x="' + (tl.x + 7).toFixed(1) + '" y="' + (tl.y + lfs * 2.25 + 6).toFixed(1) + '" style="font-size:' + (lfs * 0.92).toFixed(1) + 'px;fill:' + col.ink + '">' + val + (mode === 'gain' && it.gain != null ? ' · ' + sgnPct(it.gain) : '') + '</text>';
        else if (rw > val.length * lfs * 0.6 + 10 && rh > lfs * 1.6) label = '<text x="' + (tl.x + 6).toFixed(1) + '" y="' + (tl.y + lfs + 4).toFixed(1) + '" style="font-size:' + lfs.toFixed(1) + 'px;fill:' + col.ink + '">' + val + '</text>';
        out += '<g class="tm-tile' + (focusIds ? (focusIds.indexOf(it.id) >= 0 ? ' tm-hi' : ' tm-dim') : '') + '" tabindex="0" role="img" aria-label="' + esc(it.name + ', ' + c.label + ', ' + money0(it.v)) + '"' + tipAttr(tip) + '><rect x="' + (tl.x + 1).toFixed(1) + '" y="' + (tl.y + 1).toFixed(1) + '" width="' + rw.toFixed(1) + '" height="' + rh.toFixed(1) + '" rx="4" style="fill:' + col.fill + '"/>' + label + '</g>';
      });
    });
    var chips = '<div class="chips" role="group" aria-label="Show"><button type="button" data-act="tm-zoom" data-val="all" aria-pressed="' + (zoom === 'all') + '">Everything</button>' +
      cats.map(function (c) { return '<button type="button" data-act="tm-zoom" data-val="' + c.key + '" aria-pressed="' + (zoom === c.key) + '">' + esc(c.label) + '</button>'; }).join('') + '</div>';
    var modeSeg = '<div class="seg seg-range" role="group" aria-label="Color by"><button type="button" data-act="tm-mode" data-val="cat" aria-pressed="' + (mode === 'cat') + '">By type</button><button type="button" data-act="tm-mode" data-val="gain" aria-pressed="' + (mode === 'gain') + '">Gain / loss</button></div>';
    var key = mode === 'cat'
      ? '<div class="viz-legend">' + cats.map(function (c) { return '<span><i class="lk-area" style="--c:' + c.c + '"></i>' + esc(c.label) + ' · ' + short(c.total) + ' (' + pct(c.total / all * 100, 0) + ')</span>'; }).join('') + '</div>'
      : '<div class="viz-legend"><span>Loss</span><i class="gain-key"></i><span>Gain (stocks, up to ±50%)</span><span><i class="lk-area" style="--c:var(--div-mid)"></i>No gain data</span></div>';
    var table = '<details class="tbl"><summary>Show as a table</summary><div class="tablewrap"><table><thead><tr><th>Name</th><th>Type</th><th class="num">Value</th><th class="num">Share</th><th class="num">Gain</th></tr></thead><tbody>' +
      items.slice().sort(function (a, b) { return b.v - a.v; }).map(function (it) { var c = CAT.filter(function (x) { return x.key === it.cat; })[0]; return '<tr><td>' + esc(it.name) + '</td><td>' + esc(c.label) + '</td><td class="num">' + money0(it.v) + '</td><td class="num">' + pct(it.v / all * 100) + '</td><td class="num">' + (it.gain != null ? sgnPct(it.gain) : '—') + '</td></tr>'; }).join('') +
      '</tbody></table></div></details>';
    return '<div class="card ins-card">' + concList(finds, focus) + '<div class="ins-toolbar">' + chips + modeSeg + '</div>' + key +
      '<svg class="tm" viewBox="0 0 ' + W + ' ' + H + '" role="group" aria-label="Everything you own, sized by value" style="width:100%;height:auto;display:block">' + out + '</svg>' +
      '<p class="note">' + (t.mortgage > 0.5 ? 'Not shown: loans, ' + money0(-t.mortgage) + '. Net worth is ' + money0(t.net) + '. ' : '') + 'Hover or tap a block for details; use the buttons above to zoom into one type.</p>' + table + '</div>';
  }

  /* Concentration findings in words. */
  function concText(f) {
    var p0 = function (v) { return pct(v * 100, 0); };
    if (f.kind === 'stock') return { t: f.ticker + ' is ' + p0(f.share) + ' of your investments', d: money0(f.value) + (f.company ? ' in ' + f.company : '') + ' out of ' + money0(f.base) + ' in stocks, funds and 401(k). Many planners keep any one company under 10–15%; your limit is ' + p0(f.limit) + '.' };
    if (f.kind === 'industry') return { t: p0(f.share) + ' of your individual stocks are ' + f.industry, d: f.count + ' of your ' + f.of + ' individual stocks, ' + money0(f.value) + ' of ' + money0(f.base) + '. A downturn in one industry would hit them together. Funds aren’t counted. Your limit is ' + p0(f.limit) + '.' };
    if (f.kind === 'bank') {
      var what = [f.cds ? f.cds + (f.cds === 1 ? ' CD' : ' CDs') : '', f.accts ? f.accts + (f.accts === 1 ? ' account' : ' accounts') : ''].filter(Boolean).join(' and ');
      return { t: f.bank + ': about ' + money0(f.over) + ' over the insurance limit', d: money0(f.value) + ' across ' + what + '. FDIC (banks) and NCUA (credit unions) insure ' + money0(f.limit) + ' per person, per institution, per ownership type; joint accounts are covered up to twice that. Spreading money across banks keeps it all insured.' };
    }
    if (f.kind === 'property') return { t: 'Property is ' + p0(f.share) + ' of your net worth', d: money0(f.value) + ' after loans, of ' + money0(f.net) + '. Not a problem in itself, but it isn’t money you can spend in retirement without selling or borrowing against it.' };
    return { t: 'Cash and CDs are ' + (Math.round(f.times * 10) / 10) + '× your ' + f.months + '-month reserve', d: money0(f.value) + ' in savings and CDs, ' + money0(f.extra) + ' above the ' + money0(f.reserve) + ' reserve (' + p0(f.share) + ' of your investable money). Money you won’t need for several years may grow more invested, or could pay down loans.' };
  }
  function concList(finds, focus) {
    var warn = finds.filter(function (f) { return f.level === 'warn'; }).length;
    var head = '<div class="conc-head"><b>Concentration check</b><span>' + (warn ? warn + (warn === 1 ? ' thing' : ' things') + ' to look at' : 'Nothing flagged') + ' · <a href="#/settings" data-act="goto-conc">limits</a></span></div>';
    var hint = finds.unnamedBanks ? '<p class="conc-hint">Tip: add the bank name to your CDs and savings accounts (' + finds.unnamedBanks + ' without one) so the insurance check groups them correctly.</p>' : '';
    if (!finds.length) return '<div class="conc">' + head + '<p class="conc-ok">No single company, industry or bank is above your limits, and cash is close to your reserve.</p>' + hint + '</div>';
    return '<div class="conc">' + head + finds.map(function (f) {
      var x = concText(f), on = focus && focus.key === f.key;
      return '<button type="button" class="conc-item ' + f.level + (on ? ' on' : '') + '" data-act="conc-focus" data-key="' + esc(f.key) + '" aria-pressed="' + !!on + '"><span class="conc-ic" aria-hidden="true">' + (f.level === 'warn' ? '!' : 'i') + '</span><span><b>' + esc(x.t) + '</b>' + (on ? '<span>' + esc(x.d) + '</span>' : '') + '</span>' + CHEV + '</button>';
    }).join('') + (focus ? '<p class="conc-hint">Highlighted below. Tap it again to close.</p>' : '<p class="conc-hint">Tap one for details and to highlight it below.</p>') + hint + '</div>';
  }
  // Overview: shown only when something is worth a look.
  function concCard() {
    var w = concFindings(state).filter(function (f) { return f.level === 'warn'; });
    if (!w.length) return '';
    return '<article class="card insight conc-card"><div class="eyebrow">Concentration check</div><h3>' + w.length + (w.length === 1 ? ' thing' : ' things') + ' to look at</h3><ul>' +
      w.slice(0, 3).map(function (f) { return '<li>' + esc(concText(f).t) + '</li>'; }).join('') + (w.length > 3 ? '<li>and ' + (w.length - 3) + ' more</li>' : '') + '</ul><a class="btn" href="#/insights" data-act="goto-conc-ins">Review</a></article>';
  }

  /* 4. Life timeline */
  function milestones() {
    var st = state.settings, age0 = Math.round(n(st.goalAge)) || 50, now = parseDate(today()), out = [{ age: age0, title: 'Today', sub: money0(totals(state).net) + ' net worth', kind: 'today' }];
    var cds = state.cds.map(function (r) { var d = parseDate(r.matures); return d && d >= now ? { r: r, age: age0 + (d - now) / (365.25 * 864e5) } : null; }).filter(Boolean).sort(function (a, b) { return a.age - b.age; });
    var groups = [];
    cds.forEach(function (c) { var g = groups[groups.length - 1]; if (g && c.age - g[0].age < 0.5) g.push(c); else groups.push([c]); });
    groups.forEach(function (g) {
      var sum = g.reduce(function (a, c) { var v = cdAtMaturity(c.r); return a + (v == null ? n(c.r.principal) : v); }, 0);
      out.push({ age: g[0].age, title: g.length === 1 ? short(sum) + ' CD matures' : g.length + ' CDs mature', sub: short(sum) + (g.length === 1 ? ' · ' + g[0].r.name : ' in total'), kind: 'cd', detail: g.map(function (c) { return c.r.name + ' · ' + fmtDate(c.r.matures); }) });
    });
    state.mortgage.forEach(function (r) { var m = payoffMonths(r); if (m) out.push({ age: age0 + m / 12, title: r.name + ' paid off', sub: (r.kind || 'Mortgage') + ' · ' + n(r.rate).toFixed(2) + '%', kind: 'mortgage' }); });
    var g = goalStatus(realState());
    if (g.ok) {
      out.push({ age: g.age, title: 'Retire', sub: g.gap <= 0 ? 'Goal reached' : 'Short ' + short(g.gap) + ' of goal', kind: 'retire' });
      g.streams.forEach(function (x) { out.push({ age: x.startAge, title: x.key === 'other' ? 'Other income starts' : x.key === 'spouse' ? 'Spouse’s Social Security' : 'Social Security starts', sub: money0(x.net) + ' / mo after tax', kind: 'income' }); });
      var p = lifePlan(realState());
      if (p.ranOut) out.push({ age: p.ranOut, title: 'Savings run out', sub: 'At current plan', kind: 'warn' });
      else out.push({ age: p.endAge, title: 'Age ' + p.endAge, sub: money0(p.end) + ' left', kind: 'end' });
    }
    return { age0: age0, end: planEnd(st), items: out.filter(function (m) { return m.age >= age0 && m.age <= planEnd(st); }).sort(function (a, b) { return a.age - b.age; }) };
  }
  function insightsTimeline() {
    var ms = milestones(), age0 = ms.age0, narrow = innerWidth < 680;
    var when = function (m) { var d = ageDate(age0, m.age); return 'Age ' + Math.floor(m.age) + ' · ' + d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }); };
    if (narrow) {
      return '<div class="card ins-card"><div class="timeline">' + ms.items.map(function (m) {
        return '<div class="tl tl-' + m.kind + '"><b>' + esc(m.title) + '</b><span>' + esc(when(m)) + ' · ' + esc(m.sub) + '</span></div>';
      }).join('') + '</div></div>';
    }
    var W = 1000, H = 280, L = 30, R = 30, AY = 140, X = function (a) { return L + (a - age0) / ((ms.end - age0) || 1) * (W - L - R); };
    var lanes = [{ y: 92, end: -1e9 }, { y: 196, end: -1e9 }, { y: 44, end: -1e9 }, { y: 244, end: -1e9 }], out = '';
    out += '<line class="tl-axis" x1="' + L + '" x2="' + (W - R) + '" y1="' + AY + '" y2="' + AY + '"/>';
    for (var a = Math.ceil(age0 / 5) * 5; a <= ms.end; a += 5) out += '<line class="tl-tick" x1="' + X(a) + '" x2="' + X(a) + '" y1="' + (AY - 4) + '" y2="' + (AY + 4) + '"/><text class="ax" x="' + X(a) + '" y="' + (AY + 18) + '" text-anchor="middle">' + a + '</text>';
    var leads = '', labels = '';
    ms.items.forEach(function (m) {
      var x = X(m.age), wdt = Math.max(m.title.length * 7.2, when(m).length * 6, m.sub.length * 6) + 12;
      var lx = Math.max(L, Math.min(W - R - wdt, x - wdt / 2));
      var lane = lanes.filter(function (l) { return l.end < lx - 8; })[0] || lanes.slice().sort(function (p, q) { return p.end - q.end; })[0];
      lane.end = lx + wdt;
      var above = lane.y < AY, ty = above ? lane.y - 22 : lane.y;
      var tip = [[m.title], [when(m), ''], [m.sub, '']].concat((m.detail || []).map(function (d) { return [d, '']; }));
      leads += '<line class="tl-lead" x1="' + x.toFixed(1) + '" x2="' + x.toFixed(1) + '" y1="' + AY + '" y2="' + (above ? ty + 30 : ty - 14) + '"/>';
      labels += '<g class="tl-m tl-' + m.kind + '" tabindex="0" role="img" aria-label="' + esc(m.title + ', ' + when(m) + ', ' + m.sub) + '"' + tipAttr(tip) + '>' +
        '<rect class="tl-bg" x="' + (lx - 4).toFixed(1) + '" y="' + (ty - 14) + '" width="' + (wdt + 8).toFixed(1) + '" height="46" rx="4"/>' +
        '<text class="tl-title" x="' + lx.toFixed(1) + '" y="' + ty + '">' + esc(m.title) + '</text>' +
        '<text class="tl-sub" x="' + lx.toFixed(1) + '" y="' + (ty + 15) + '">' + esc(when(m)) + '</text>' +
        '<text class="tl-sub" x="' + lx.toFixed(1) + '" y="' + (ty + 29) + '">' + esc(m.sub) + '</text>' +
        '<circle class="tl-dot" cx="' + x.toFixed(1) + '" cy="' + AY + '" r="6"/></g>';
    });
    out += leads + labels;
    return '<div class="card ins-card"><svg class="tl-svg" viewBox="0 0 ' + W + ' ' + H + '" role="group" aria-label="Life timeline from today to age ' + ms.end + '" style="width:100%;height:auto;display:block">' + out + '</svg></div>';
  }

  /* 5. What changed (waterfall of the change in net worth) */
  function insightsChanged() {
    var r = ui.wfRange || '3m', start = rangeStart(r), td = today(), view = ui.wfView === 'account' ? 'account' : 'cause';
    var hist = state.history.filter(function (e) { return e.stocks != null; }).sort(function (a, b) { return a.date < b.date ? -1 : 1; });
    var inRange = hist.filter(function (e) { return e.date >= start && e.date < td; });
    var base = inRange[0];
    // By cause needs a snapshot that has the stock cost basis; use the earliest such one in the period.
    var cbase = inRange.filter(function (e) { return e.stockCost != null; })[0];
    var viewSeg = '<div class="seg seg-range" role="group" aria-label="Group by"><button type="button" data-act="wf-view" data-val="cause" aria-pressed="' + (view === 'cause') + '">By cause</button><button type="button" data-act="wf-view" data-val="account" aria-pressed="' + (view === 'account') + '">By account</button></div>';
    var causeNote = '';
    if (view === 'cause') {
      if (cbase) base = cbase;
      else if (base) { view = 'account'; causeNote = '<p class="conc-hint wf-hint">By cause needs snapshots saved since this update, which include your stock cost basis. It fills in from tomorrow; until then this shows the change by account.</p>'; }
    }
    var seg = '<div class="seg seg-range" role="group" aria-label="Period">' + RANGES.map(function (x) { return '<button type="button" data-act="wf-range" data-val="' + x[0] + '" aria-pressed="' + (r === x[0]) + '">' + x[1] + '</button>'; }).join('') + '</div>';
    if (!base) {
      var msg = !hist.length || (hist.length === 1 && hist[0].date === td)
        ? 'This fills in as daily snapshots build up. Check back after a few days of using the app.'
        : 'No snapshot before today in this period. Try a longer one.';
      return '<div class="card ins-card"><div class="ins-toolbar">' + viewSeg + seg + '</div><div class="empty">' + msg + '</div></div>';
    }
    var t = totals(state);
    var nw = innerWidth < 680;
    var days = (parseDate(td) - parseDate(base.date)) / 864e5, cc = view === 'cause' ? changeCauses(state, base, days) : null;
    var tipRow = function (l, v) { return [l, signed(v), v >= 0 ? 'var(--div-pos)' : 'var(--div-neg)']; };
    var parts = cc ? [
      ['You added', cc.added, [['Money you added, net of withdrawals'], tipRow('Stocks & funds (bought less sold)', cc.addS), tipRow('401(k)' + (cc.k4stale ? ' · balance not updated' : ' · from your yearly contributions'), cc.addK), tipRow('Savings & CDs (deposits less withdrawals)', cc.addC)]],
      ['Market', cc.market, [['Market moves'], tipRow('Stocks & funds', cc.mktS), tipRow('401(k)' + (cc.k4stale ? ' · balance not updated' : ''), cc.mktK)]],
      ['Interest', cc.interest, [['Interest earned (estimated)'], tipRow('Savings & CDs', cc.interest), ['From balances and APY' + (cc.cashStale ? '; savings unchanged, so CDs only' : '')]]],
      [nw ? 'Loans' : 'Loans paid', cc.loans, [[cc.loans >= 0 ? 'Loans paid down' : 'Loans grew'], tipRow('Change', cc.loans)]],
      ['Property', cc.property, [['Property & assets value'], tipRow('Change', cc.property)]]
    ] : [['Stocks', t.stocks - base.stocks], ['401(k)', t.k401 - base.k401], ['CDs', t.cds - base.cds], ['Savings', t.cash - base.cash], [nw ? 'Assets' : 'Property', t.assets - base.assets], ['Loans', base.mortgage - t.mortgage]];
    var total = t.net - base.net;
    var nar = innerWidth < 680, W = nar ? 420 : 1000, H = 300, L = nar ? 44 : 64, R = nar ? 6 : 20, T = 30, B = 40, n2 = parts.length + 1, slot = (W - L - R) / n2, bw = nar ? 18 : 24;
    var cum = 0, lo = 0, hi = 0;
    parts.forEach(function (p) { cum += p[1]; lo = Math.min(lo, cum); hi = Math.max(hi, cum); });
    lo = Math.min(lo, total, 0); hi = Math.max(hi, total, 0);
    var span = (hi - lo) || 1, step = niceStep(span / 4), gmin = Math.floor(lo / step) * step, gmax = Math.ceil(hi / step) * step;
    if (gmax === gmin) gmax = gmin + step;
    var Y = function (v) { return T + (gmax - v) / (gmax - gmin) * (H - T - B); }, out = '';
    for (var g = gmin; g <= gmax + 1e-6; g += step) out += '<line class="grid" x1="' + L + '" x2="' + (W - R) + '" y1="' + Y(g).toFixed(1) + '" y2="' + Y(g).toFixed(1) + '"/><text class="ax" x="' + (L - 8) + '" y="' + (Y(g) + 4).toFixed(1) + '" text-anchor="end">' + short(g) + '</text>';
    out += '<line class="wf-zero" x1="' + L + '" x2="' + (W - R) + '" y1="' + Y(0).toFixed(1) + '" y2="' + Y(0).toFixed(1) + '"/>';
    var bar = function (i, from, to, cls, label, tip) {
      var cx = L + slot * i + slot / 2, x = cx - bw / 2, y1 = Y(Math.max(from, to)), y2 = Y(Math.min(from, to)), hgt = Math.max(1.5, y2 - y1), up = to >= from;
      var lab = Math.abs(to - from) < 0.5 ? '$0' : (to - from < 0 ? '−' : '+') + compact(Math.abs(to - from));
      return '<g class="wf-bar" tabindex="0" role="img" aria-label="' + esc(label + ': ' + lab) + '"' + tipAttr(tip) + '>' +
        '<rect x="' + (cx - slot / 2 + 4).toFixed(1) + '" y="' + T + '" width="' + (slot - 8).toFixed(1) + '" height="' + (H - T - B) + '" fill="transparent"/>' +
        '<rect class="' + cls + '" x="' + x.toFixed(1) + '" y="' + y1.toFixed(1) + '" width="' + bw + '" height="' + hgt.toFixed(1) + '" rx="3"/>' +
        '<text class="lever-val" x="' + cx.toFixed(1) + '" y="' + (up ? y1 - 7 : y2 + 15).toFixed(1) + '" text-anchor="middle">' + lab + '</text>' +
        '<text class="ax" x="' + cx.toFixed(1) + '" y="' + (H - 14) + '" text-anchor="middle">' + esc(label) + '</text></g>';
    };
    cum = 0;
    parts.forEach(function (p, i) {
      var from = cum, to = cum + p[1];
      out += bar(i, from, to, p[1] >= 0 ? 'wf-up' : 'wf-down', p[0], p[2] ? p[2].concat([['Running total', signed(to)]]) : [[p[0] === 'Loans' ? (p[1] >= 0 ? 'Loans paid down' : 'Loans grew') : p[0] === 'Assets' ? 'Property & assets' : p[0]], ['Change', signed(p[1]), p[1] >= 0 ? 'var(--div-pos)' : 'var(--div-neg)'], ['Running total', signed(to)]]);
      if (i < parts.length) {
        var nx = L + slot * (i + 1) + slot / 2 - bw / 2;
        out += '<line class="wf-link" x1="' + (L + slot * i + slot / 2 + bw / 2).toFixed(1) + '" x2="' + nx.toFixed(1) + '" y1="' + Y(to).toFixed(1) + '" y2="' + Y(to).toFixed(1) + '"/>';
      }
      cum = to;
    });
    out += bar(parts.length, 0, total, 'wf-total', nar ? 'Net' : 'Net change', [['Net change'], ['From ' + fmtDate(base.date), money0(base.net)], ['Today', money0(t.net)], ['Change', signed(total)]]);
    var head = '<div class="wf-head"><b class="' + (total < 0 ? 'neg' : 'pos') + '">' + signed(total) + (base.net ? ' (' + sgnPct(total / Math.abs(base.net) * 100) + ')' : '') + '</b><span>since ' + fmtDate(base.date) + ' · ' + money0(base.net) + ' → ' + money0(t.net) + '</span></div>';
    var summary = cc ? '<p class="wf-sum">' + (Math.abs(total) < 0.5 ? 'No change' : 'Of the ' + signed(total) + ', <b>' + signed(cc.added) + '</b> was money you added and <b class="' + (cc.market < 0 ? 'neg' : 'pos') + '">' + signed(cc.market) + '</b> came from the market' + (Math.abs(cc.interest) >= 0.5 ? ', plus ' + signed(cc.interest) + ' interest' : '') + '.') + '</p>' : '';
    var note = cc ? 'Money you added counts stock purchases less sales (from cost basis), 401(k) contributions from your yearly setting' + (cc.k4stale ? ' (your 401(k) balance wasn’t updated in this period, so it shows no change)' : '') + ', and savings and CD deposits less withdrawals; moves between your own accounts cancel out. Interest is estimated from balances and APY. Market is the rest of the change in stocks and the 401(k). Compared with your snapshot from ' + fmtDate(base.date) + '.'
      : 'Changes include both money you added and market moves. Loans shows the amount paid down. Compared with your snapshot from ' + fmtDate(base.date) + '.';
    return '<div class="card ins-card"><div class="ins-toolbar">' + head + '<div class="wf-ctl">' + viewSeg + seg + '</div></div>' + summary + causeNote +
      '<div class="viz-legend"><span><i class="lk-area" style="--c:var(--div-pos)"></i>Increase</span><span><i class="lk-area" style="--c:var(--div-neg)"></i>Decrease</span><span><i class="lk-area" style="--c:var(--muted)"></i>Net change</span></div>' +
      '<svg viewBox="0 0 ' + W + ' ' + H + '" role="group" aria-label="What changed in net worth, ' + (cc ? 'by cause' : 'by account type') + '" style="width:100%;height:auto;display:block">' + out + '</svg>' +
      '<p class="note">' + note + '</p></div>';
  }

  function renderInsights() {
    return '<header class="head"><div><div class="eyebrow">Insights · today’s dollars</div><h1>See where your money is going.</h1></div></header>' +
      '<section class="ins"><div class="section-head"><h2>Retirement what-if</h2><p>Drag the sliders to test changes. The chart and the “What helps most” bars update as you go.</p></div>' + insightsWhatIf() + '</section>' +
      '<section class="ins"><div class="section-head"><h2>Will the money last?</h2><p>Your current plan from today to age ' + planEnd(state.settings) + ', with market ups and downs or by account type. Hover for each year.</p></div>' + insightsLast() + '</section>' +
      '<section class="ins"><div class="section-head"><h2>Everything you own</h2><p>Each block is sized by value. Big blocks are where your money is concentrated.</p></div>' + insightsTreemap() + '</section>' +
      '<section class="ins"><div class="section-head"><h2>Life timeline</h2><p>Milestones from today to age ' + planEnd(state.settings) + '.</p></div>' + insightsTimeline() + '</section>' +
      '<section class="ins"><div class="section-head"><h2>What changed</h2><p>Where the change in your net worth came from.</p></div>' + insightsChanged() + '</section>';
  }
  var insActs = {
    'wi-scen': function (el) { ui.whatIf.scenario = el.dataset.val; refreshWhatIf(); },
    'wi-reset': function () { ui.whatIf = wiDefaults(); render(); },
    'wi-apply': function () {
      var w = ui.whatIf, d = wiDefaults(), st = state.settings, lines = [];
      if (w.extra) lines.push('add ' + money0(w.extra) + ' a month (' + money0(w.extra * 12) + ' a year) to stock contributions');
      if (w.retire !== d.retire) lines.push('retire at ' + w.retire);
      if (w.claim !== d.claim && n(st.ssBenefit) > 0) lines.push('start Social Security at ' + w.claim);
      if (w.spend !== d.spend) lines.push('retirement spending of ' + money0(w.spend) + ' a month');
      if (w.scenario !== d.scenario) lines.push('the ' + SCEN[w.scenario].label + ' market scenario');
      if (!lines.length || !confirm('Update your plan to ' + lines.join(', ') + '?')) return;
      Object.assign(st, wiOver(w));
      ui.whatIf = null; save(); render(); toast('Plan updated');
    },
    'tm-mode': function (el) { ui.tmMode = el.dataset.val; render(); },
    'tm-zoom': function (el) { ui.tmZoom = el.dataset.val; render(); },
    'wf-range': function (el) { ui.wfRange = el.dataset.val; render(); },
    'last-view': function (el) { ui.lastView = el.dataset.val; render(); },
    'wf-view': function (el) { ui.wfView = el.dataset.val; render(); },
    'conc-focus': function (el) { ui.concFocus = ui.concFocus === el.dataset.key ? null : el.dataset.key; render(); if (ui.concFocus) { var svg = $('svg.tm'); if (svg && svg.getBoundingClientRect().top > innerHeight - 120) svg.scrollIntoView({ block: 'center', behavior: 'smooth' }); } },
    'goto-conc': function () { setTimeout(function () { var c = $('#setConc'); if (c) c.scrollIntoView({ block: 'start' }); }, 60); },
    'goto-conc-ins': function () { setTimeout(function () { var c = $('.conc'); if (c) c.scrollIntoView({ block: 'start' }); }, 60); }
  };
  document.addEventListener('input', function (e) {
    var k = e.target.dataset && e.target.dataset.wi; if (!k || !ui.whatIf) return;
    ui.whatIf[k] = parseInt(e.target.value, 10);
    refreshWhatIf();
  });
  var lastNarrow = innerWidth < 680, rsTimer;
  window.addEventListener('resize', function () {
    clearTimeout(rsTimer);
    rsTimer = setTimeout(function () { var nw = innerWidth < 680; if (nw !== lastNarrow) { lastNarrow = nw; if (currentView() === 'insights') softRender(); } }, 200);
  });

  /* ---------- settings ---------- */
  function incomeFields() {
    var st = state.settings, yr = new Date().getFullYear(), streams = retireIncome(st);
    var find = function (k) { return streams.filter(function (x) { return x.key === k; })[0]; };
    var claimHint = function (x, who) {
      if (!x) return 'Between 62 and 70.';
      return 'At ' + x.claimAge + ', ' + who + ' benefit is ' + money0(x.gross) + ' a month (' + Math.round(x.factor * 100) + '% of the full amount' + (n(st.ssCut) ? ', after the ' + n(st.ssCut) + '% cut' : '') + '), about ' + money0(x.net) + ' after tax.';
    };
    var fra = fraYears(yr - n(st.goalAge)), fraTxt = fra % 1 ? Math.floor(fra) + ' and ' + Math.round((fra % 1) * 12) + ' months' : String(fra);
    return '<div class="field"><span class="lab">Social Security and other income</span><span class="hint">Monthly amounts in today’s dollars. Guaranteed income lowers what your savings need to cover.</span></div>' +
      numField('ssBenefit', 'Your Social Security at full retirement age, per month ($)', '10', 'From your statement at ssa.gov/myaccount. Your full retirement age is ' + fraTxt + '. Use 0 to leave it out.') +
      numField('ssClaimAge', 'Age you’ll start Social Security', '1', claimHint(find('ss'), 'your')) +
      numField('ssSpouseBenefit', 'Spouse’s Social Security at full retirement age, per month ($)', '10', 'Optional. 0 leaves it out.') +
      (n(st.ssSpouseBenefit) > 0 ? numField('ssSpouseAge', 'Spouse’s current age', '1', '') + numField('ssSpouseClaimAge', 'Age your spouse will start', '1', claimHint(find('spouse'), 'their')) : '') +
      numField('ssCut', 'Assume Social Security is cut by (%)', '1', 'Optional safety margin. The trustees project the trust fund could run short in the mid-2030s, which would mean a cut of about 20% unless Congress acts. 0 assumes full benefits.') +
      numField('otherIncome', 'Other guaranteed income, per month ($)', '50', 'A pension, rental income or annuity. Taxed at your 401(k) withdrawal rate.') +
      (n(st.otherIncome) > 0 ? numField('otherStartAge', 'Starts at your age', '1', '') : '');
  }
  function numField(key, label, step, hint) {
    return '<div class="field"><label for="s_' + key + '">' + label + '</label><input id="s_' + key + '" type="number" min="0" step="' + step + '" inputmode="decimal" value="' + esc(n(state.settings[key])) + '" data-set="' + key + '" data-fk="s_' + key + '">' + (hint ? '<span class="hint">' + hint + '</span>' : '') + '</div>';
  }
  function taxField(key, label, hint) {
    return '<div class="field"><label for="s_' + key + '">' + label + '</label><input id="s_' + key + '" type="number" min="0" max="60" step="0.5" inputmode="decimal" value="' + esc(n(state.settings[key])) + '" data-set="' + key + '" data-fk="s_' + key + '"><span class="hint">' + hint + '</span></div>';
  }
  function historyCard() {
    var hs = state.history.slice().sort(function (a, b) { return a.date < b.date ? -1 : 1; });
    return '<section class="card set-card" aria-labelledby="setHist"><h2 id="setHist">Net worth history</h2>' +
      '<p>' + (hs.length ? hs.length + ' snapshot' + (hs.length === 1 ? '' : 's') + ' from ' + fmtDate(hs[0].date) + ' to ' + fmtDate(hs[hs.length - 1].date) + '.' : 'No snapshots yet.') + ' One per day: today’s entry keeps updating while you use the page, so it holds your last numbers of the day. Days you don’t open the page are left as gaps.</p>' +
      '<label class="check"><input type="checkbox" data-set="autoSnap" data-fk="autoSnap"' + (state.settings.autoSnap ? ' checked' : '') + '> Save a snapshot automatically every day</label>' +
      '<p class="hint" style="margin:0">With automatic price refresh on, the day’s first snapshot waits for the first refresh during market hours. Sample data is never recorded.</p>' +
      '<div class="actions"><button class="btn" data-act="export-history">Export history (CSV)</button><button class="btn danger" data-act="clear-history"' + (hs.length ? '' : ' disabled') + '>Delete all history</button></div>' +
      '<div class="field"><label for="delSnap">Delete one day</label><div class="inline"><input type="date" id="delSnap" data-fk="delSnap"><button class="btn" data-act="del-snap" type="button">Delete</button></div></div></section>';
  }
  function cloudBlock() {
    if (!cloudAvailable()) return '<p class="status-line">OneDrive sync works on the published page. This copy was opened from a file, so data stays on this device; use Export and Import below to move it.</p>';
    if (!prefs.cloud) return '<p>Sign in with your <strong>personal</strong> Microsoft account. The page can only see its own folder, OneDrive › Apps › Portfolio Studio, and keeps ' + esc(CLOUD.file) + ' there.</p><div class="actions"><button class="btn primary" data-act="cloud-signin">Sign in to OneDrive</button></div>';
    var a = loadAuth() || {}, ok = cloud.status === 'synced' || cloud.status === 'syncing';
    return '<div class="status-line ' + (ok ? 'ok' : cloud.status === 'offline' ? '' : 'bad') + '">' + esc(saveText()) + '</div>' +
      '<p>' + (a.name || a.user ? 'Signed in as ' + esc(a.name || a.user) + (a.name && a.user ? ' (' + esc(a.user) + ')' : '') + '. ' : '') + 'File: OneDrive › Apps › Portfolio Studio › ' + esc(prefs.cloudFile || CLOUD.file) + '.</p>' +
      (cloud.missing && !hasData(state) ? '<p class="status-line bad">No data file found in OneDrive › Apps › Portfolio Studio yet. Import your data below or start entering it, and it will be uploaded there. If your file is in another folder, move it into that one.</p>' : '') +
      '<p class="hint" style="margin:0">The most recently edited copy wins, and net worth history from every device is combined. If a sync would drop items added on another device, you are asked first. Microsoft sign-in lasts about a day; after that the page signs you back in when it opens, or asks you to.</p>' +
      '<div class="actions">' + (cloud.status === 'signin' ? '<button class="btn primary" data-act="cloud-signin">Sign in again</button>' : '<button class="btn" data-act="cloud-sync">Sync now</button>') + '<button class="btn danger" data-act="cloud-signout">Sign out on this device</button></div>' +
      '<p class="hint" style="margin:0">Signing out uploads your latest changes, then removes your data, history and backups from this device. Your data stays in OneDrive.</p>';
  }
  function backupWhen(ts) { return new Date(ts).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' }); }
  // portfolio-data-2026-10-07-0815.json → Oct 7, 2026, 8:15 AM
  function cloudBackupWhen(name) {
    var m = /(\d{4})-(\d{2})-(\d{2})-(\d{2})(\d{2})/.exec(name);
    return m ? backupWhen(new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]).getTime()) : name;
  }
  function backupsCard() {
    var list = loadBackups();
    var rows = list.map(function (b, i) {
      return '<li><div><b>' + esc(backupWhen(b.at)) + '</b><span class="muted">' + esc(b.reason) + ' · ' + esc(b.sum) + '</span></div><button class="btn sm" data-act="restore-local" data-i="' + i + '">Restore</button></li>';
    }).join('');
    return '<section class="card set-card" aria-labelledby="setBackup"><h2 id="setBackup">Backups</h2>' +
      '<p>This device keeps up to ' + BACKUP_KEEP + ' copies of your accounts and settings: one a day, and one before anything replaces your data, such as a sync, an import, a delete or a restore. Net worth history is not part of backups and is never changed by a restore.</p>' +
      (rows ? '<ul class="backups">' + rows + '</ul>' : '<p class="hint">No backups yet. The first one is made the next time the page opens with your data.</p>') +
      (prefs.cloud && cloudAvailable() ? '<div class="field"><span class="lab">OneDrive backups</span><span class="hint">Each device saves the OneDrive copy once a day, before changing it, to OneDrive › Apps › Portfolio Studio › backups. The newest ' + CLOUD_KEEP + ' are kept.</span><div id="cloudBackups"><div class="actions"><button class="btn" data-act="cloud-backups">Show OneDrive backups</button></div></div></div>' : '') +
      '<p class="hint" style="margin:0">Portfolio Studio version ' + APP_VERSION + ' (build ' + APP_BUILD + ').</p></section>';
  }
  var LOCK_AFTER = [[0, 'Right away'], [1, 'After 1 minute'], [5, 'After 5 minutes'], [15, 'After 15 minutes']];
  function lockCard() {
    var l = lockPrefs(), after = prefs.lock && prefs.lock.after != null ? n(prefs.lock.after) : 1;
    var head = '<section class="card set-card" aria-labelledby="setLock"><h2 id="setLock">App lock</h2><p>Ask for Face ID, Touch ID or your device passcode before showing anything. For this device only; each device turns it on separately. It hides the app, it doesn’t encrypt your data.</p>';
    if (!window.PublicKeyCredential || !window.isSecureContext) return head + '<p class="status-line">Not available here. App lock needs the published site (or localhost) in a browser with Face ID, Touch ID or Windows Hello.</p></section>';
    return head + '<div class="seg seg-view" role="group" aria-labelledby="setLock"><button type="button" data-act="lock-set" data-val="off" aria-pressed="' + !l + '">Off</button><button type="button" data-act="lock-set" data-val="on" aria-pressed="' + !!l + '">On</button></div>' +
      '<div class="field"><label for="lockAfter">Lock again when the app has been in the background</label><select id="lockAfter" class="mini" data-fk="lockAfter"' + (l ? '' : ' disabled') + '>' +
      LOCK_AFTER.map(function (o) { return '<option value="' + o[0] + '"' + (after === o[0] ? ' selected' : '') + '>' + o[1] + '</option>'; }).join('') + '</select>' +
      '<span class="hint">The screen is always covered while the app is in the background, so the app switcher doesn’t show your numbers.</span></div>' +
      (l ? '<div class="actions"><button type="button" class="btn" data-act="lock-now">Lock now</button></div>' : '') + '</section>';
  }
  function renderSettings() {
    var f = state.feed, prov = FEEDS[f.provider] || FEEDS.finnhub, key = prefs.keys[f.provider] || '', st = state.settings;
    var provOpts = Object.keys(FEEDS).map(function (k) { return '<option value="' + k + '"' + (f.provider === k ? ' selected' : '') + '>' + FEEDS[k].label + '</option>'; }).join('');
    var fileBlock = cloudBlock();
    var themeBtns = [['system', 'System'], ['light', 'Light'], ['dark', 'Dark']].map(function (x) { return '<button type="button" data-act="theme" data-val="' + x[0] + '" aria-pressed="' + (prefs.theme === x[0]) + '">' + x[1] + '</button>'; }).join('');
    return '<header class="head"><div><div class="eyebrow">Settings</div><h1>Prices, saving, and your plan.</h1></div></header>' +
      '<div class="set-grid">' +
      '<section class="card set-card" aria-labelledby="setShow"><h2 id="setShow">Data shown</h2><p>Switch to made-up sample data to try things out or show the app to someone without revealing your numbers. Your own data stays saved and untouched; nothing is saved or synced while sample data is showing, and the app always opens on your own data.</p>' +
      '<div class="seg seg-view" role="group" aria-labelledby="setShow"><button type="button" data-act="demo" data-val="off" aria-pressed="' + !ui.demo + '">My data</button><button type="button" data-act="demo" data-val="on" aria-pressed="' + !!ui.demo + '">Sample data</button></div></section>' +
      '<section class="card set-card" aria-labelledby="setSave"><h2 id="setSave">Saving and sync</h2><p>Every change saves on this device automatically. OneDrive sync keeps your computer and phone in step.</p>' + fileBlock +
      '<div class="field"><span class="lab">Copies and backups</span><div class="actions"><button class="btn" data-act="export-json">Export data (JSON)</button><button class="btn" data-act="import-json">Import data</button><button class="btn" data-act="export-csv">Export accounts (CSV)</button></div></div>' +
      '<div class="field"><span class="lab">Start over</span><div class="actions"><button class="btn danger" data-act="clear-all">Remove all data</button></div></div></section>' +
      '<section class="card set-card" aria-labelledby="setFeed"><h2 id="setFeed">Live price feed</h2><p>Stock and fund prices come from a market-data service that needs a free API key. The key stays on this device: it is not part of exports or OneDrive sync, and it is sent only to ' + esc(prov.label) + '.</p>' +
      '<div class="field"><label for="feedProvider">Provider</label><select id="feedProvider" data-feed="provider" data-fk="feedProvider">' + provOpts + '</select><span class="hint">' + esc(prov.note) + '</span></div>' +
      '<div class="field"><label for="feedKey">API key</label><div class="inline"><input id="feedKey" type="password" autocomplete="off" spellcheck="false" value="' + esc(key) + '" placeholder="Paste your key" data-fk="feedKey"><button class="btn" data-act="toggle-key" type="button">Show</button><button class="btn" data-act="test-feed" type="button">Test</button></div>' +
      '<span class="hint"><a href="' + prov.signup + '" target="_blank" rel="noopener noreferrer">Get a free ' + esc(prov.label) + ' key</a> · takes about a minute.</span></div>' +
      '<div class="field"><label for="feedKey2">Backup key: ' + esc(FEEDS[altProvider()].label) + ' <span class="muted">(optional)</span></label><input id="feedKey2" type="password" autocomplete="off" spellcheck="false" value="' + esc(altKey()) + '" placeholder="Paste a key" data-fk="feedKey2">' +
      '<span class="hint">Used only for symbols ' + esc(prov.label) + ' can’t price, such as some mutual funds. Also stays on this device. <a href="' + FEEDS[altProvider()].signup + '" target="_blank" rel="noopener noreferrer">Get a free ' + esc(FEEDS[altProvider()].label) + ' key</a>.</span></div>' +
      '<div id="feedTest"></div>' +
      '<div class="field"><label for="autoSettings">Refresh automatically</label>' + autoSelect('autoSettings') + '<span class="hint">Runs while this page is open and visible, and as soon as it opens if the time has passed. Also refreshes once after each 4:00 PM close for closing prices.</span></div>' +
      '<label class="check"><input type="checkbox" data-feed="marketHoursOnly" data-fk="mho"' + (f.marketHoursOnly ? ' checked' : '') + '> Only during US market hours (9:30 to 4:00 New York time, weekdays)</label>' +
      '<label class="check"><input type="checkbox" data-set="tickerMarket" data-fk="tickerMarket"' + (st.tickerMarket ? ' checked' : '') + '> Show the S&amp;P 500 (SPY) and Nasdaq-100 (QQQ) in the Overview ticker</label>' +
      '<p class="hint" style="margin:0">Adds those two symbols to each refresh, unless you already hold them.</p>' +
      '<div class="actions">' + refreshBtn(true) + '</div></section>' +
      backupsCard() +
      historyCard() +
      '<section class="card set-card" aria-labelledby="setGoal"><h2 id="setGoal">Retirement goal</h2><p>Shown on the Overview and Projections pages. Compares your investments and cash at retirement, after estimated taxes, with what you would need. Home equity is not counted.</p>' +
      numField('goalAge', 'Your current age', '1', '') +
      numField('goalRetireAge', 'Retirement age', '1', '') +
      numField('goalMonthly', 'Monthly income you want in retirement, in today’s dollars ($)', '100', 'What you want to spend each month; the goal uses 12 times this a year. Taxes on 401(k) withdrawals and stock gains are already taken out of your savings before this comparison.') +
      numField('goalRate', 'Withdrawal rate (%)', '0.1', 'The share of your savings you take out each year. 4% is a common rule of thumb for about 30 years of retirement; a lower rate is safer.') +
      numField('mcVolStocks', 'How much stocks swing in a year (%)', '1', 'Used for the chance-of-success estimate in Insights. The typical size of a year’s ups and downs: about 15–18% for a stock index fund. 0 turns the swings off.') +
      numField('mcVol401', 'How much the 401(k) swings in a year (%)', '1', 'About 12% for a mostly-stock 401(k), 8–10% for a balanced or target-date fund, lower with more bonds.') +
      numField('planAge', 'Plan until age', '1', 'How far the lifetime plan in Insights runs, from 85 to 105. 95 is a common choice; 100 adds a safety margin.') +
      incomeFields() +
      '</section>' +
      '<section class="card set-card" aria-labelledby="setTax"><h2 id="setTax">Taxes</h2><p>Used for the after-tax figures on the Overview, Stocks and Projections pages. Rough estimates, not tax advice: dividends, short-term gains, deductions and the home-sale exclusion are left out.</p>' +
      taxField('taxCapGains', 'Long-term capital gains rate, federal (%)', 'Most households pay 15%; 0% at lower incomes and 20% at the highest. Assumes each position has been held over a year.') +
      taxField('taxState', 'State income tax rate (%)', 'Added on top of each rate here. 0 in states such as Florida and Texas.') +
      taxField('taxInterest', 'Tax rate on interest from savings and CDs, federal (%)', 'Your top income tax bracket. Interest is taxed every year, so projected savings and CDs grow after this tax.') +
      taxField('taxK401', 'Tax rate on 401(k) withdrawals, federal (%)', 'Traditional 401(k) money is taxed as income when withdrawn, often at a lower rate in retirement. Use 0 for a Roth 401(k).') +
      '</section>' +
      '<section class="card set-card" aria-labelledby="setPlan"><h2 id="setPlan">Cash reserve</h2><p>Used on the Overview to show how much cash sits above, or below, your emergency reserve.</p>' +
      '<div class="field"><label for="s_monthlyExpenses">Monthly spending ($)</label><input id="s_monthlyExpenses" type="number" min="0" step="100" inputmode="decimal" value="' + esc(n(st.monthlyExpenses)) + '" data-set="monthlyExpenses" data-fk="s_monthlyExpenses"></div>' +
      '<div class="field"><label for="s_reserveMonths">Months to keep in reserve</label><input id="s_reserveMonths" type="number" min="0" step="1" inputmode="numeric" value="' + esc(n(st.reserveMonths)) + '" data-set="reserveMonths" data-fk="s_reserveMonths"></div></section>' +
      '<section class="card set-card" aria-labelledby="setConc"><h2 id="setConc">Concentration check</h2><p>Limits for the warnings in Insights › Everything you own (and on the Overview when something is flagged). 0 turns a check off.</p>' +
      numField('concStock', 'One company, % of investments', '1', 'Stocks and private holdings, as a share of stocks, funds and 401(k). Funds aren’t flagged. 10–15% is a common guideline.') +
      numField('concIndustry', 'One industry, % of individual stocks', '5', 'Checked once you have 3 or more individual stocks with a known industry (from Finnhub).') +
      numField('concInsure', 'Insurance limit per bank ($)', '1000', 'FDIC and NCUA insure $250,000 per person, per bank. Use $500,000 if your accounts there are joint.') +
      numField('concCash', 'Cash above your reserve, % of investable money', '5', 'Flags savings and CDs beyond your cash reserve when they’re more than this share of stocks, 401(k), CDs and savings.') +
      '</section>' +
      lockCard() +
      '<section class="card set-card" aria-labelledby="setLook"><h2 id="setLook">Appearance</h2><p>Follow your system setting, or pick one.</p><div class="seg seg-theme" role="group" aria-labelledby="setLook">' + themeBtns + '</div></section>' +
      '</div>';
  }

  /* ---------- dialog ---------- */
  var dlg = $('#dlg'), dlgForm = $('#dlgForm'), dlgCtx = null;
  function setDlgHead(title, submit, intro) {
    $('#dlgTitle').textContent = title;
    $('#dlgSubmit').textContent = submit || 'Save';
    var p = $('#dlgIntro'); p.textContent = intro || ''; p.hidden = !intro;
  }
  function openDialog(cat, id, opts) {
    opts = opts || {};
    var def = CATS[cat], rec = id ? state[cat].filter(function (r) { return r.id === id; })[0] : null;
    if (id && !rec) return;
    dlgCtx = { cat: cat, id: id || null, replace: opts.replace || null };
    setDlgHead(opts.title || ((rec ? 'Edit ' : 'Add ') + def.one), opts.submit, opts.intro);
    $('#dlgDelete').hidden = !rec;
    $('#dlgBody').innerHTML = def.fields.map(function (f) {
      var val = rec ? rec[f.key] : opts.prefill && f.key in opts.prefill ? opts.prefill[f.key] : (f.key === 'type' ? 'Stock' : f.key === 'opened' ? today() : '');
      if (f.key === 'term' && rec && val == null) val = termMonths(rec);
      var idAttr = 'f_' + f.key, common = ' id="' + idAttr + '" name="' + f.key + '"' + (f.req ? ' required' : '');
      if (f.type === 'checkbox') return '<label class="check"><input type="checkbox"' + common + (val ? ' checked' : '') + '> ' + esc(f.label) + '</label>';
      var control;
      if (f.type === 'select') control = '<select' + common + '>' + f.options.map(function (o) { return '<option' + (o === val ? ' selected' : '') + '>' + esc(o) + '</option>'; }).join('') + '</select>';
      else if (f.type === 'number') control = '<input' + common + ' type="number" step="any" inputmode="decimal"' + (f.min != null ? ' min="' + f.min + '"' : '') + ' value="' + (val === null || val === undefined ? '' : esc(val)) + '">';
      else control = '<input' + common + ' type="' + f.type + '" value="' + esc(val) + '" autocomplete="off">';
      return '<div class="field"><label for="' + idAttr + '">' + esc(f.label) + (f.req ? '' : ' <span class="muted">(optional)</span>') + '</label>' + control + (f.hint ? '<span class="hint">' + esc(f.hint) + '</span>' : '') + '</div>';
    }).join('');
    if (cat === 'cds') wireCdTerm();
    dlg.showModal();
    var first = dlg.querySelector('input,select'); if (first) first.focus();
  }
  function round2(v) { return Math.round(v * 100) / 100; }
  function payout(cd) { var v = cdAtMaturity(cd); return round2(v == null ? cdValueNow(cd) : v); }
  function openRenew(id) {
    var cd = state.cds.filter(function (r) { return r.id === id; })[0]; if (!cd) return;
    var term = termMonths(cd) || 12, start = parseDate(cd.matures) ? cd.matures : today();
    openDialog('cds', null, {
      title: 'Renew CD', submit: 'Renew', replace: cd.id,
      intro: cd.name + ' pays out about ' + money2(payout(cd)) + ' on ' + fmtDate(cd.matures) + '. The new CD starts with that amount and the same term. Its previous rate was ' + n(cd.apy).toFixed(2) + '%; enter the new rate below. Saving replaces the old CD.',
      prefill: { name: cd.name, principal: payout(cd), apy: '', opened: start, term: term, matures: addMonths(start, term) }
    });
  }
  function openMove(id) {
    var cd = state.cds.filter(function (r) { return r.id === id; })[0]; if (!cd) return;
    dlgCtx = { mode: 'move', cat: 'cds', id: id };
    var past = daysUntil(cd.matures) < 0;
    setDlgHead('Move to savings', 'Move', cd.name + (past ? ' matured on ' : ' matures on ') + fmtDate(cd.matures) + '. The payout is added to the account you pick and the CD is removed.');
    $('#dlgDelete').hidden = true;
    var best = state.cash.slice().sort(function (a, b) { return n(b.apy) - n(a.apy); })[0];
    var opts = state.cash.map(function (r) { return '<option value="' + esc(r.id) + '"' + (best && r.id === best.id ? ' selected' : '') + '>' + esc(r.name) + ' · ' + money0(n(r.balance)) + ' · ' + n(r.apy).toFixed(2) + '% APY</option>'; }).join('') +
      '<option value="__new"' + (best ? '' : ' selected') + '>A new savings account</option>';
    $('#dlgBody').innerHTML =
      '<div class="field"><label for="f_amount">Amount ($)</label><input id="f_amount" name="amount" type="number" step="any" min="0" inputmode="decimal" required value="' + payout(cd) + '"><span class="hint">Principal plus interest at maturity. Adjust it to match what the bank actually pays.</span></div>' +
      '<div class="field"><label for="f_target">Into</label><select id="f_target" name="target">' + opts + '</select></div>';
    dlg.showModal();
    $('#f_amount').focus();
  }
  function submitMove() {
    var cd = state.cds.filter(function (r) { return r.id === dlgCtx.id; })[0]; if (!cd) { dlg.close(); return; }
    var amt = round2(parseFloat(dlgForm.elements.amount.value) || 0), target = dlgForm.elements.target.value, name;
    if (target === '__new') { name = 'Savings from ' + cd.name; state.cash.push({ id: uid(), name: name, balance: amt, apy: 0 }); }
    else {
      var acc = state.cash.filter(function (r) { return r.id === target; })[0];
      acc.balance = round2(n(acc.balance) + amt); name = acc.name;
    }
    state.cds = state.cds.filter(function (r) { return r.id !== cd.id; });
    pending = false; save(); dlg.close(); render();
    toast('Moved ' + money2(amt) + ' to ' + name + '. ' + cd.name + ' removed.');
  }
  dlg.addEventListener('close', function () { if (pending) { pending = false; softRender(); } });
  dlgForm.addEventListener('submit', function (e) {
    e.preventDefault();
    if (!dlgForm.reportValidity()) return;
    if (dlgCtx.mode === 'move') return submitMove();
    var def = CATS[dlgCtx.cat], vals = {};
    def.fields.forEach(function (f) {
      var el = dlgForm.elements[f.key];
      if (f.type === 'checkbox') vals[f.key] = el.checked;
      else if (f.type === 'number') vals[f.key] = el.value === '' ? (f.nullable ? null : 0) : parseFloat(el.value);
      else vals[f.key] = el.value.trim();
    });
    if (dlgCtx.cat === 'stocks') vals.ticker = vals.ticker.toUpperCase();
    var list = state[dlgCtx.cat], old = dlgCtx.id ? list.filter(function (r) { return r.id === dlgCtx.id; })[0] : null;
    var rec = Object.assign(dlgCtx.cat === 'stocks' ? { prevClose: null, quoteTime: null, quoteSource: '', quoteError: null } : {}, old || {}, vals);
    if (dlgCtx.cat === 'stocks' && (!old || old.price !== vals.price)) { rec.prevClose = null; rec.quoteError = null; rec.quoteTime = vals.price === null ? null : Date.now(); rec.quoteSource = vals.price === null ? '' : 'Entered'; }
    // A new or changed ticker looks up its logo again.
    if (dlgCtx.cat === 'stocks' && (!old || old.ticker !== rec.ticker || old.symbol !== rec.symbol)) { rec.logo = ''; rec.logoChecked = null; delete rec.industry; setTimeout(fetchLogos, 800); }
    if (old) { rec.id = old.id; list[list.indexOf(old)] = rec; } else { rec.id = uid(); list.push(rec); }
    var wasEdit = !!old, replaced = dlgCtx.replace;
    if (replaced) state[dlgCtx.cat] = state[dlgCtx.cat].filter(function (r) { return r.id !== replaced; });
    if (dlgCtx.cat !== 'stocks') ui.tab = ui.acOpen = dlgCtx.cat;
    pending = false; save(); dlg.close(); render();
    toast(replaced ? 'CD renewed' : wasEdit ? 'Changes saved' : 'Added');
  });

  /* ---------- files ---------- */
  function download(name, text, type) {
    var blob = new Blob([text], { type: type }), a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
  }
  function csvCell(v) { v = String(v == null ? '' : v); return /[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; }
  function toCsv(rows) { return rows.map(function (r) { return r.map(csvCell).join(','); }).join('\r\n'); }
  function accountsCsv() {
    var rows = [['Category', 'Name', 'Value', 'Cost basis', 'Rate / APY (%)', 'Quantity', 'Price', 'Details']];
    state.stocks.forEach(function (r) { rows.push(['Stocks & funds', r.ticker + ' ' + r.company, priced(r) ? (n(r.qty) * n(r.price)).toFixed(2) : '', (n(r.qty) * n(r.cost)).toFixed(2), '', r.qty, priced(r) ? r.price : '', r.type + (r.quoteTime ? ', price as of ' + new Date(r.quoteTime).toISOString() : '')]); });
    state.k401.forEach(function (r) { rows.push(['401(k)', r.name, n(r.balance).toFixed(2), '', '', '', '', 'Contributions per year ' + n(r.contrib)]); });
    state.cds.forEach(function (r) { rows.push(['CD', r.name, cdValueNow(r).toFixed(2), '', r.apy, '', '', 'Principal ' + n(r.principal).toFixed(2) + ', opened ' + r.opened + ', matures ' + r.matures]); });
    state.cash.forEach(function (r) { rows.push(['Savings & checking', r.name, n(r.balance).toFixed(2), '', r.apy, '', '', '']); });
    state.assets.forEach(function (r) { rows.push(['Asset', r.name, n(r.value).toFixed(2), '', '', '', '', 'Change per year ' + n(r.growth) + '%']); });
    state.mortgage.forEach(function (r) { rows.push(['Loan', r.name, (-n(r.balance)).toFixed(2), '', r.rate, '', '', (r.kind || 'Mortgage') + ', monthly payment ' + n(r.payment)]); });
    return toCsv(rows);
  }
  $('#importFile').addEventListener('change', function (e) {
    var f = e.target.files[0]; e.target.value = '';
    if (!f) return;
    var rd = new FileReader();
    rd.onload = function () {
      try {
        var data = JSON.parse(rd.result);
        if (!looksValid(data)) throw new Error('shape');
        if (!confirm('Replace everything currently in this page with the contents of "' + f.name + '"?')) return;
        backupNow('Before importing ' + f.name);
        state = normalize(data); state.meta.sample = false; state.meta.migrated = false;
        save(); render(); toast('Data imported');
      } catch (err) { toast('That file does not look like exported portfolio data.'); }
    };
    rd.readAsText(f);
  });

  /* ---------- events ---------- */
  var actions = {
    'tab': function (el) { ui.tab = ui.acOpen = el.dataset.cat; render(); },
    'goto-tab': function (el) { ui.tab = ui.acOpen = el.dataset.cat; },
    'pj-year': function (el) { var i = +el.dataset.i; ui.pjOpen = ui.pjOpen === i ? null : i; refreshProjOutputs(); },
    'ac-toggle': function (el) {
      var k = el.dataset.cat;
      ui.acOpen = ui.acOpen === k ? null : k;
      if (ui.acOpen) ui.tab = k;
      render();
      // Keep the opened row in view, just under the top of the screen.
      if (ui.acOpen) { var row = document.querySelector('.ac-row[data-cat="' + k + '"]'); if (row && row.getBoundingClientRect().top < 0) row.scrollIntoView({ block: 'start' }); }
    },
    'add': function (el) { openDialog(el.dataset.cat); },
    'edit': function (el) { openDialog(el.dataset.cat, el.dataset.id); },
    'dlg-delete': function () {
      var cat = dlgCtx.cat, list = state[cat], rec = list.filter(function (r) { return r.id === dlgCtx.id; })[0];
      if (!rec || !confirm('Delete "' + (rec.ticker || rec.name) + '"? A backup is kept in Settings.')) return;
      backupNow('Before deleting ' + (rec.ticker || rec.name));
      state[cat] = list.filter(function (r) { return r.id !== rec.id; });
      pending = false; save(); dlg.close(); render(); toast('Deleted');
    },
    'dlg-close': function () { dlg.close(); },
    'hist-range': function (el) { state.settings.histRange = el.dataset.val; save(); render(); },
    'hist-tax': function (el) { state.settings.histAfterTax = el.dataset.val === 'after'; save(); render(); },
    'export-history': function () {
      var rows = [['Date', 'Net worth', 'Net worth after tax', 'Stocks & funds', '401(k)', 'CDs', 'Savings & checking', 'Property & assets', 'Loans', 'Saved by hand']];
      state.history.slice().sort(function (a, b) { return a.date < b.date ? -1 : 1; }).forEach(function (e) {
        rows.push([e.date, e.net, e.netAfter == null ? '' : e.netAfter, e.stocks == null ? '' : e.stocks, e.k401 == null ? '' : e.k401, e.cds == null ? '' : e.cds, e.cash == null ? '' : e.cash, e.assets == null ? '' : e.assets, e.mortgage == null ? '' : e.mortgage, e.manual ? 'yes' : '']);
      });
      download('net-worth-history-' + today() + '.csv', toCsv(rows), 'text/csv');
    },
    'clear-history': function () {
      if (!confirm('Delete all ' + state.history.length + ' net worth snapshots? This cannot be undone.')) return;
      state.history = []; save(); render(); toast(state.settings.autoSnap ? 'History deleted. Today’s snapshot starts again automatically.' : 'History deleted');
    },
    'del-snap': function () {
      var d = ($('#delSnap') || {}).value;
      if (!d) { toast('Pick a date first.'); return; }
      if (!state.history.some(function (e) { return e.date === d; })) { toast('No snapshot on ' + fmtDate(d) + '.'); return; }
      state.history = state.history.filter(function (e) { return e.date !== d; });
      var isToday = d === today() && state.settings.autoSnap;
      save(); render(); toast('Deleted the snapshot for ' + fmtDate(d) + (isToday ? '. Today’s is recreated automatically.' : '.'));
    },
    'cd-renew': function (el) { openRenew(el.dataset.id); },
    'cd-move': function (el) { openMove(el.dataset.id); },
    'sort': function (el) {
      var k = el.dataset.key;
      if (ui.sort.key === k) ui.sort.dir *= -1; else ui.sort = { key: k, dir: typeof SORTS[k]({ ticker: '', price: 0, qty: 0, cost: 0 }) === 'string' ? 1 : -1 };
      render();
    },
    'refresh': function () { refreshPrices(true); },
    'movers-all': function () { ui.sort = { key: 'day', dir: -1 }; },
    'snapshot': function () {
      var d = today(), e = snapEntry(state, d);
      e.manual = true;
      state.history = state.history.filter(function (h) { return h.date !== d; });
      state.history.push(e);
      save(); render(); toast('Snapshot saved for today');
    },
    'scenario': function (el) { state.settings.scenario = el.dataset.val; save(); refreshProjOutputs(); },
    'horizon-goal': function () { var g = goalStatus(state); if (g.ok) { state.settings.horizon = Math.min(40, g.yrs); save(); render(); } },
    'aftertax': function (el) { state.settings.afterTax = el.dataset.val === 'after'; save(); refreshProjOutputs(); },
    'cdmode': function (el) { state.settings.cdMode = el.dataset.val; save(); refreshProjOutputs(); },
    'projview': function (el) { state.settings.projView = el.dataset.val; save(); refreshProjOutputs(); },
    'reset-proj': function () {
      var d = defaultSettings();
      ['scenario', 'horizon', 'stocksGrowth', 'k401Growth', 'stocksContrib', 'cashContrib', 'inflation', 'real', 'contribGrowth', 'cdMode'].forEach(function (k) { state.settings[k] = d[k]; });
      save(); render(); toast('Assumptions reset');
    },
    'theme': function (el) { prefs.theme = el.dataset.val; savePrefs(); applyTheme(); render(); },
    'toggle-key': function (el) { var i = $('#feedKey'); var show = i.type === 'password'; i.type = show ? 'text' : 'password'; el.textContent = show ? 'Hide' : 'Show'; },
    'test-feed': function () {
      var keyEl = $('#feedKey'); prefs.keys[state.feed.provider] = keyEl.value.trim(); savePrefs();
      var out = $('#feedTest'), prov = FEEDS[state.feed.provider];
      if (!feedKey()) { out.innerHTML = '<div class="status-line bad">Paste a key first.</div>'; return; }
      var r = state.stocks.filter(function (x) { return !x.manual; })[0], sym = r ? String(r.symbol || r.ticker).toUpperCase() : 'AAPL';
      out.innerHTML = '<div class="status-line">Checking ' + esc(sym) + ' with ' + esc(prov.label) + '…</div>';
      prov.quote(sym, feedKey()).then(function (q) {
        out.innerHTML = '<div class="status-line ok">Connected. ' + esc(sym) + ' is ' + px(q.price) + '.</div>';
        paintLive();
      }, function (e) { out.innerHTML = '<div class="status-line bad">' + esc(e.message) + '</div>'; });
    },
    'dismiss-banner': function () { state.meta.sample = false; save(); render(); },
    'dismiss-migrated': function () { state.meta.migrated = false; state.meta.sample = false; save(); render(); },
    'clear-all': function () {
      if (!confirm('Remove every account, snapshot and setting from this page' + (prefs.cloud ? ' and from OneDrive' : '') + '? A backup is kept on this device in Settings.')) return;
      backupNow('Before removing all data');
      var feed = state.feed;
      state = normalize({ feed: feed }); state.meta.sample = false; save(); render(); toast('Cleared. Add your first account to begin.');
    },
    'load-sample': function () {
      if (!confirm('Replace everything in this page with sample data?')) return;
      backupNow('Before loading sample data');
      var feed = state.feed; state = seed(); state.feed = feed; save(); render(); toast('Sample data loaded');
    },
    'reload': function () { location.reload(); },
    'unlock': function () { unlock(); },
    'lock-now': function () { lockNow(); },
    'lock-set': function (el) { var on = el.dataset.val === 'on'; if (on === !!lockPrefs()) return; if (on) enableLock(); else disableLock(); },
    'lock-signout': function () {
      if (!confirm('Sign out and remove your data from this device?\n\nYour data stays in OneDrive (except changes from this device that haven’t synced yet). Signing in again brings it back.')) return;
      lockState.locked = false; document.documentElement.classList.remove('locked', 'veiled');
      $('#lock').hidden = true; $('#lock').innerHTML = '';
      prefs.lock = { on: false, after: prefs.lock ? prefs.lock.after : 1 };
      signOutHere();
    },
    'hide-amounts': function () { prefs.hide = !prefs.hide; savePrefs(); render(); toast(prefs.hide ? 'Amounts hidden on this device' : 'Amounts shown'); },
    'demo': function (el) { showSample(el.dataset.val === 'on'); },
    'restore-local': function (el) {
      var b = loadBackups()[+el.dataset.i]; if (!b) return;
      if (!confirm('Restore the backup from ' + backupWhen(b.at) + ' (' + b.sum + ')? It replaces your current accounts and settings on every synced device. Net worth history is kept. Your current data is backed up first.')) return;
      try { restoreData(JSON.parse(b.data), 'the backup from ' + backupWhen(b.at)); } catch (e) { toast('That backup could not be read.'); }
    },
    'cloud-backups': function () {
      var out = $('#cloudBackups'); if (!out) return;
      out.innerHTML = '<p class="hint">Loading OneDrive backups…</p>';
      listCloudBackups().then(function (files) {
        ui.cloudBackups = files;
        out.innerHTML = files.length ? '<ul class="backups">' + files.map(function (f, i) {
          return '<li><div><b>' + esc(cloudBackupWhen(f.name)) + '</b><span class="muted">' + Math.max(1, Math.round(n(f.size) / 1024)) + ' KB</span></div><button class="btn sm" data-act="restore-cloud" data-i="' + i + '">Restore</button></li>';
        }).join('') + '</ul>' : '<p class="hint">No OneDrive backups yet. The first one is saved at the next sync.</p>';
      }, function () { out.innerHTML = '<p class="hint">Could not load the OneDrive backups. Check your connection and try again.</p>'; });
    },
    'restore-cloud': function (el) {
      var f = (ui.cloudBackups || [])[+el.dataset.i]; if (!f) return;
      var label = 'the OneDrive backup from ' + cloudBackupWhen(f.name);
      if (!confirm('Restore ' + label + '? It replaces your current accounts and settings on every synced device. Net worth history is kept. Your current data is backed up first.')) return;
      graph('/me/drive/items/' + encodeURIComponent(f.id)).then(function (item) {
        return fetch(item['@microsoft.graph.downloadUrl'], { cache: 'no-store' });
      }).then(function (r) {
        if (!r.ok) throw new Error('download');
        return r.json();
      }).then(function (data) {
        if (!looksValid(data)) throw new Error('shape');
        restoreData(data, label);
      }).catch(function () { toast('That backup could not be loaded.'); });
    },
    'export-json': function () { download('portfolio-data-' + today() + '.json', JSON.stringify(state, null, 2), 'application/json'); },
    'import-json': function () { $('#importFile').click(); },
    'export-csv': function () { download('portfolio-accounts-' + today() + '.csv', accountsCsv(), 'text/csv'); },
    'proj-csv': function () {
      var rows = [['Year', 'Stocks & funds', '401(k)', 'CDs & cash', 'Home & vehicle', 'Loans', 'Net worth', 'Est. taxes if cashed out', 'Net worth after tax']];
      project(state).forEach(function (r) { rows.push([r.y === 0 ? 'Today' : r.year, r.stocks.toFixed(2), r.k401.toFixed(2), (r.cds + r.cash).toFixed(2), r.assets.toFixed(2), (-r.mortgage).toFixed(2), r.net.toFixed(2), (r.taxStocks + r.tax401).toFixed(2), r.netAfter.toFixed(2)]); });
      download('portfolio-projection-' + today() + '.csv', toCsv(rows), 'text/csv');
    }
  };
  Object.assign(actions, cloudActs, insActs);
  // Actions that would change your real data, or the sync, wait until you switch back from sample data.
  var REAL_ONLY = ['import-json', 'clear-all', 'load-sample', 'restore-local', 'restore-cloud', 'cloud-backups', 'cloud-sync', 'cloud-signin', 'cloud-signout', 'dismiss-banner'];
  document.addEventListener('click', function (e) {
    var el = e.target.closest('[data-act]');
    if (!el || !actions[el.dataset.act]) return;
    if (ui.demo && REAL_ONLY.indexOf(el.dataset.act) >= 0) { toast('Switch back to your data first. Sample data is showing.'); return; }
    actions[el.dataset.act](el, e);
  });
  // Live redraw of projection results while typing or dragging.
  document.addEventListener('input', function (e) {
    var el = e.target, key = el.dataset && el.dataset.set;
    if (!key || !$('#projOut') || el.type === 'checkbox') return;
    state.settings[key] = key === 'horizon' ? parseInt(el.value, 10) : n(el.value);
    saveSoon(); refreshProjOutputs();
  });
  document.addEventListener('change', function (e) {
    var el = e.target, ds = el.dataset || {};
    if (ds.price) {
      var rec = findStock(ds.price);
      if (rec) {
        var v = el.value === '' ? null : Math.max(0, n(el.value));
        if (v !== (priced(rec) ? n(rec.price) : null)) {
          rec.price = v; rec.prevClose = null; rec.quoteError = null; rec.quoteTime = v === null ? null : Date.now(); rec.quoteSource = v === null ? '' : 'Entered';
          save();
        }
        // Let Tab move focus first, then redraw and put focus back where it went.
        setTimeout(render, 0);
      }
      return;
    }
    if (ds.set) {
      var key = ds.set;
      state.settings[key] = el.type === 'checkbox' ? el.checked : (key === 'horizon' ? parseInt(el.value, 10) : n(el.value));
      save();
      if ($('#projOut')) refreshProjOutputs(); else if (currentView() === 'settings') setTimeout(render, 0); else renderSideFoot();
      return;
    }
    if (ds.feed) {
      var fk = ds.feed;
      state.feed[fk] = el.type === 'checkbox' ? el.checked : fk === 'autoMins' ? parseInt(el.value, 10) : el.value;
      save(); setTimeout(render, 0);
      if (fk === 'autoMins' && state.feed.autoMins && !feedKey()) toast('Auto-refresh starts once you add an API key in Settings.');
      else if (fk === 'autoMins' || fk === 'marketHoursOnly') setTimeout(autoTick, 50);
      return;
    }
    if (el.id === 'lockAfter') { prefs.lock = Object.assign({}, prefs.lock, { after: n(el.value) }); savePrefs(); return; }
    if (el.id === 'hsort') { var sp = el.value.split(':'); ui.sort = { key: sp[0], dir: +sp[1] }; render(); return; }
    if (el.id === 'feedKey') { prefs.keys[state.feed.provider] = el.value.trim(); savePrefs(); paintLive(); }
    if (el.id === 'feedKey2') { prefs.keys[altProvider()] = el.value.trim(); savePrefs(); }
  });
  document.addEventListener('toggle', function (e) { var d = e.target; if (d.dataset && d.dataset.blk) ui.openYears[d.dataset.blk] = d.open; }, true);
  window.addEventListener('hashchange', render);
  document.addEventListener('visibilitychange', function () { if (!document.hidden) { paintLive(); autoTick(); } });
  window.addEventListener('storage', function (e) {
    // Signed out in another tab: this tab reloads too, so it doesn't keep showing, or save back, the removed data.
    if (e.key === KEY && e.newValue === null) { location.reload(); return; }
    if (e.key === KEY && e.newValue && !ui.demo) { try { state = normalize(JSON.parse(e.newValue)); if (newerBuild(state)) outdated = true; softRender(); } catch (err) { /* ignore */ } }
  });
  setInterval(function () { autoTick(); paintLive(); if (snapDue()) { save(true); softRender(); } }, 30000);

  dailyBackup();
  if (state.meta.migrated) save(true);
  if (snapDue()) save(true);
  render();
  initCloud();
  if ('serviceWorker' in navigator && cloudAvailable()) navigator.serviceWorker.register('sw.js').catch(function () { /* offline cache is optional */ });
  setTimeout(autoTick, 1500);
})();
