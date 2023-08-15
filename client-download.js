Figure.prototype.clientDownload = function (whatExport) {
  const
    figureUnifier = location.hash.substr(1),
    figureFileName = figureUnifier.replace(/[^\w\.]/g, '_'),
    figureAcidName = 'Acidome_' + figureFileName.replace(/\W/g, '_');

  var obj = {
    points: [],
    faces: [],
    add: function (what, entity) {
      what += 's';
      if (!entity.index) {
        this[what].push(entity);
        entity.index = this[what].length;
      }
      return entity.index;
    },
    output: []
  },

    R = parseFloat(window.form.state.radius); // => m

  switch (whatExport) {
    case 'faces':
      const faces = _.filter(figure.subs('face'), face => !face.removed && face.live);

      _.each(faces, function (face) {
        console.log('g ' + figureAcidName + ' ' + face.unifier.replace(/\W/g, '_'));
        obj.output.push('g ' + figureAcidName + ' ' + face.unifier.replace(/\W/g, '_'));

        var points = _.map(face.$points, function (vect) {
          if (!vect.index) {
            vect.scale(R);
            obj.output.push('v ' + vect.x + ' ' + vect.y + ' ' + vect.z);
          }
          return obj.add('point', vect);
        });
        obj.output.push('f ' + points.join(' '));

        obj.output.push('end');
      });
      break;

    case 'frame':
    default:
      whatExport = 'frame';
      const
        lines = _.chain(figure.subs('face'))
          .map(face => {
            return face.bindedLines || face.subs('line').get();
          })
          .flatten()
          .unique()
          .value(),

        ribs = lines
          .filter(line => !line.removed && line.live)
          .map(line => {
            return {
              faces: line.product.model(true),
              unifier: line.product.unify().replace(/\s/g, '_') +
                ' ' + line.index
            };
          });

      $.each(ribs, function (r, rib) {
        obj.output.push('g ' + figureAcidName + ' ' + rib.unifier);

        var faces = $.map(rib.faces, function (face) {
          var points = $.map(face, function (vect) {
            if (!vect.index) {
              vect.scale(R);
              obj.output.push('v ' + vect.x + ' ' + vect.y + ' ' + vect.z);
            }
            return obj.add('point', vect);
          });
          obj.output.push('f ' + points.join(' '));
          return obj.add('face', points);
        });
        obj.output.push('surf 0.0 1.0 0.0 1.0 ' + faces.join(' '));
        obj.output.push('end');
      });
      break;
  }

  // with header
  obj = [
    '##',
    '# //acidome.ru/lab/calc/#' + figureUnifier,
    '#',
    '# (c) ' + (new Date).getFullYear() + ' acidome.ru/lab/calc',
    '# Under CC-BY-SA license',
    '# File units = ' + /*milli*/ 'meters',
    '#',
    ''
  ].concat(obj.output).join('\r\n');

  const fileName = figureFileName + ' ' + whatExport + '.obj';

  // output 2.0
  return download(fileName, "application/object", obj);

  function download(filename, type, text) {
    var element = document.createElement('a');
    element.setAttribute('href', 'data:' + type + ';charset=utf-8,' + encodeURIComponent(text));
    element.setAttribute('download', filename);
    element.style.display = 'none';
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  }
};