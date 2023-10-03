/**
 * Accumulator of values ​​and their statistics
 *
 * var meter = new Meter;
 *
 * meter.push( [ groupKey ], { key: value, .. } );
 *
 */

Meter = function () {
  this.values = {};
}
  .override({
    // push()
    push: function (map, context) {
      if (typeof map == 'string') {
        var h = {}, args = [].slice.call(arguments, 0);
        h[args[0]] = args[1];
        args[1] = h;
        return this.push.apply(this, args.slice(1));
      }

      context = context || this.values;
      for (var k in map) {
        var matchFn = /^(\w+):(.*)$/.exec(k),
          fn = (matchFn && this.operators[matchFn[1]]) ? matchFn[1] : 'default';

        if (fn == 'default' && typeof (map[k]) == 'object') {
          context[k] = context[k] || {};
          this.push(map[k], context[k]);
        }
        else {
          context[k] = this.operators[fn](context[k], map[k]);
        }
      }
    },

    operators: {
      default: function (accum, value) { // sum
        return (accum || (isNaN(value) ? '' : 0)) + value;
      },

      min: function (accum, value) {
        return (accum == undefined) ? value : Math.min(accum, value);
      },

      max: function (accum, value) {
        return (accum == undefined) ? value : Math.max(accum, value);
      },

      swing: function (accum, value) {
        return {
          min: (accum && accum.min != undefined) ? Math.min(accum.min, value) : value,
          max: (accum && accum.max != undefined) ? Math.max(accum.max, value) : value
        };
      },

      range: function (accum, value) {
        return {
          min: (accum && accum.min != undefined) ? Math.min(accum.min, value) : value,
          max: (accum && accum.max != undefined) ? Math.max(accum.max, value) : value
        };
      }
    },

    reporters: {
      swing: function (value) {
        return (value.max || 0) - (value.min || 0);
      },

      range: function (value) {
        return (value.max - value.min < 1e-6) ? value.min : [value.min, '-', value.max];
      }
    },

    reportText: function (context, indent, report) {
      indent = indent || '';
      context = context || this.values;
      report = report || [];

      var objects = [];

      for (var k in context) {
        var matchFn = /^(\w+):(.*)$/.exec(k),
          key = k, value = context[k];

        if (matchFn) {
          if (this.reporters[matchFn[1]])
            value = this.reporters[matchFn[1]](value);
          key = matchFn[2];
        }

        if (typeof value == 'object' && !(value instanceof Array)) {
          objects.push({
            key: '\n' + indent + key.bold(),
            val: false
          });
          this.reportText(value, indent + '    ', objects);
        }
        else {
          report.push({
            key: indent + key,
            val: value
          });
        }
      }

      $.each(objects, function () {
        report.push(this);
      });

      var maxKeyLength = 0;
      return (arguments.length == 3) ? 0 :
        $(report).each(function () {
          maxKeyLength = Math.max(this.key.length, maxKeyLength);
          return this;
        }).map(function () {
          while (this.key.length < maxKeyLength)
            this.key += ' ';
          var key = this.key.replace(/(,\s*.)(\d)(\D|$)/, '$1&sup$2;$3');
          return key + '  ' + (this.val ?
            $.map(
              $.makeArray(this.val),
              function (val) {
                return typeof val == 'number' ? Meter.numberFormat(val) : val;
              }
            ).join('') :
            '');
        }).get().join('\n');
    }
  });

Meter.numberFormat = function (val) {
  if (!val) return '';
  var val100 = Math.round(val / .01);
  return Math.floor(val100 / 100) + (
    (val100 % 100) ?
      '.' + (
        (val100 % 100) < 10 ? '0' : ''
      ) +
      (val100 % 100)
      : ''
  );
}