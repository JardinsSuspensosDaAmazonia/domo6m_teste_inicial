// https: start
// if (location.protocol === 'http:') {
// 	location.protocol = 'https:';
// 	//return;
// }

// timing start
const _pageLoadingStartAt = +new Date;

// offline detection
const IS_OFFLINE = (document.location.protocol == 'file:');

// iframe --
const IS_IFRAME = (window.top !== window.self);

// clear any GET params from URL
var CLEARED_LOCATION_SEARCH = !IS_OFFLINE && !IS_IFRAME && location.search,
  CLEARED_GET_PARAMS = CLEARED_LOCATION_SEARCH && {};
if (CLEARED_LOCATION_SEARCH) (function () {
  var pairs = CLEARED_LOCATION_SEARCH.substr(1).split('&'), pair;

  while (pair = pairs.pop()) {
    pair = pair.split('=');
    CLEARED_GET_PARAMS[decodeURIComponent(pair[0])] = decodeURIComponent(pair[1]);
  }
  history.replaceState(null, null, location.href.replace(CLEARED_LOCATION_SEARCH, ''));
})();

/** App config
 */
const CONFIG = {
  get: function (path, ctx) {
    ctx = ctx || this;
    path = (path || '').split('.');
    for (; ctx && path.length; ctx = ctx[path.shift()]);
    return ctx;
  },
  defaultFigure: {
    // form
    base: 'Icosahedron', // Octohedron
    detail: 6,
    subdivClass: 'II', //'III_1,2',
    M: 0,
    N: 0,
    subdivMethod: 'Kruschke', // 'Chords',
    symmetry: 'Pentad',
    fullerenType: 'none', //'inscribed',

    // cutting; format: by height - 0.12345 or by faces - 3/8
    partialMode: 'faces', // 'height'
    partial: '1/2', //'5/8', //'1/4',
    partialHeight: .777,

    alignTheBase: false,

    // connection type
    connType: 'Piped', //'Semicone',
    pipeD: '0',
    clockwise: true,

    // metrics
    radius: '4',

    beamsWidth: '20',
    beamsThickness: '20',

    // deprecated
    clothier: {
      width: 2100,
      height: 12000
    }
  },
  view: {
    modeCover: {
      opacity: (over, removed) => {
        return removed ? .03 : (over ? .95 : .90);
      }
    },
    modeTent: {
      present: true || !!CLEARED_GET_PARAMS["tent"]
    },
    drawings: {
      face: {
        cols: 2
      }
    },
    wysiwyg: {
      // use form.showEthalon({ true|false }) as semaphor
      ethalon: false
    }
  }
};