(function(f){if(typeof exports==="object"&&typeof module!=="undefined"){module.exports=f()}else if(typeof define==="function"&&define.amd){define([],f)}else{var g;if(typeof window!=="undefined"){g=window}else if(typeof global!=="undefined"){g=global}else if(typeof self!=="undefined"){g=self}else{g=this}g.RadialProgressChart = f()}})(function(){var define,module,exports;return (function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
'use strict';

var d3;

// RadialProgressChart object
function RadialProgressChart(query, options) {

  // verify d3 is loaded
  d3 = (typeof window !== 'undefined' && window.d3) ? window.d3 : typeof require !== 'undefined' ? require("d3") : undefined;
  if(!d3) throw new Error('d3 object is missing. D3.js library has to be loaded before.');

  var self = this;
  self.options = RadialProgressChart.normalizeOptions(options);

  // internal  variables
  var series = self.options.series
    , width = 15 + ((self.options.diameter / 2) + (self.options.stroke.width * self.options.series.length) + (self.options.stroke.gap * self.options.series.length - 1)) * 2
    , height = width
    , dim = "0 0 " + height + " " + width
    , τ = 2 * Math.PI
    , inner = []
    , outer = [];

  function innerRadius(item) {
    var radius = inner[item.index];
    if (radius) return radius;

    // first ring based on diameter and the rest based on the previous outer radius plus gap
    radius = item.index === 0 ? self.options.diameter / 2 : outer[item.index - 1] + self.options.stroke.gap;
    inner[item.index] = radius;
    return radius;
  }

  function outerRadius(item) {
    var radius = outer[item.index];
    if (radius) return radius;

    // based on the previous inner radius + stroke width
    radius = inner[item.index] + self.options.stroke.width;
    outer[item.index] = radius;
    return radius;
  }

  self.progress = d3.svg.arc()
    // .startAngle(0)
    // .endAngle(function (item) {
    //   return item.percentage / 100 * τ;
    // })

    .startAngle(function(item) {
      if(item.reverse) {
        return τ;
      }
      return 0;
    })
    .endAngle(function (item) {
      if(item.reverse) {
        console.log("end", item.labelStart, τ - (item.percentage / 100 * τ));
        return τ - (item.percentage / 100 * τ);
      }
      return item.percentage / 100 * τ;
    })
    .innerRadius(innerRadius)
    .outerRadius(outerRadius)
    .cornerRadius(function (d) {
      // Workaround for d3 bug https://github.com/mbostock/d3/issues/2249
      // Reduce corner radius when corners are close each other
      var m = d.percentage >= 90 ? (100 - d.percentage) * 0.1 : 1;
      return (self.options.stroke.width / 2) * m;
    });

  var background = d3.svg.arc()
    .startAngle(0)
    .endAngle(τ)
    .innerRadius(innerRadius)
    .outerRadius(outerRadius);

  // create svg
  self.svg = d3.select(query).append("svg")
    .attr("preserveAspectRatio","xMinYMin meet")
    .attr("viewBox", dim)
    .append("g")
    .attr("transform", "translate(" + width / 2 + "," + height / 2 + ")");

  // add gradients defs
  var defs = self.svg.append("svg:defs");
  series.forEach(function (item) {
    if (item.color.linearGradient || item.color.radialGradient) {
      var gradient = RadialProgressChart.Gradient.toSVGElement('gradient' + item.index, item.color);
      defs.node().appendChild(gradient);
    }
  });

  // add shadows defs
  defs = self.svg.append("svg:defs");
  var dropshadowId = "dropshadow-" + Math.random();
  var filter = defs.append("filter").attr("id", dropshadowId);
  if(self.options.shadow.width > 0) {
    
    filter.append("feGaussianBlur")
      .attr("in", "SourceAlpha")
      .attr("stdDeviation", self.options.shadow.width)
      .attr("result", "blur");

    filter.append("feOffset")
      .attr("in", "blur")
      .attr("dx", 1)
      .attr("dy", 1)
      .attr("result", "offsetBlur");
  }

  var feMerge = filter.append("feMerge");
  feMerge.append("feMergeNode").attr("in", "offsetBlur");
  feMerge.append("feMergeNode").attr("in", "SourceGraphic");

  // add inner text
  if (self.options.center) {
    self.svg.append("text")
      .attr('class', 'rbc-center-text')
      .attr("text-anchor", "middle")
      .attr('x', self.options.center.x + 'px')
      .attr('y', self.options.center.y + 'px')
      .selectAll('tspan')
      .data(self.options.center.content).enter()
      .append('tspan')
      .attr("dominant-baseline", function () {

        // Single lines can easily centered in the middle using dominant-baseline, multiline need to use y
        if (self.options.center.content.length === 1) {
          return 'central';
        }
      })
      .attr('class', function (d, i) {
        return 'rbc-center-text-line' + i;
      })
      .attr('x', 0)
      .attr('dy', function (d, i) {
        if (i > 0) {
          return '1.1em';
        }
      })
      .each(function (d) {
        if (typeof d === 'function') {
          this.callback = d;
        }
      })
      .text(function (d) {
        if (typeof d === 'string') {
          return d;
        }

        return '';
      });
  }

  // add ring structure
  self.field = self.svg.selectAll("g")
    .data(series)
    .enter().append("g");

  self.field.append("path").attr("class", "progress").attr("filter", "url(#" + dropshadowId +")")
    .style("stroke-width", 5)
    .style("stroke", "white");

  self.field.append("path").attr("class", "bg")
    .style("fill", function (item) {
      return item.color.background;
    })
    .style("opacity", 0.2)
    .attr("d", background);

  self.field.append("text")
    .classed('rbc-label rbc-label-start', true)
    .attr("dominant-baseline", "central")
    .attr("x", "10")
    .attr("y", function (item) {
      return -(
        self.options.diameter / 2 +
        item.index * (self.options.stroke.gap + self.options.stroke.width) +
        self.options.stroke.width / 2
        );
    })
    .style("fill", function(item) {
        return item.fill;
    })
    .text(function (item) {
      return item.labelStart;
    });

  self.update();
}

/**
 * Update data to be visualized in the chart.
 *
 * @param {Object|Array} data Optional data you'd like to set for the chart before it will update. If not specified the update method will use the data that is already configured with the chart.
 * @example update([70, 10, 45])
 * @example update({series: [{value: 70}, 10, 45]})
 *
 */
RadialProgressChart.prototype.update = function (data) {
  var self = this;
  console.log("updating!", data);

  // parse new data
  if (data) {
    if (typeof data === 'number') {
      data = [data];
    }

    var series;

    if (Array.isArray(data)) {
      series = data;
    } else if (typeof data === 'object') {
      series = data.series || [];
    }

    for (var i = 0; i < series.length; i++) {
      this.options.series[i].previousValue = this.options.series[i].value;

      var item = series[i];
      if (typeof item === 'number') {
        this.options.series[i].value = item;
      } else if (typeof item === 'object') {
        this.options.series[i].value = item.value;
        // update item.labelStart value
        if(item.labelStart) {
          this.options.series[i].labelStart = item.labelStart; 
        }
      }
    }
  }

  // calculate from percentage and new percentage for the progress animation
  self.options.series.forEach(function (item) {
    item.fromPercentage = item.percentage ? item.percentage : 5;
    item.percentage = (item.value - self.options.min) * 100 / (self.options.max - self.options.min);
  });

  var center = self.svg.select("text.rbc-center-text");

  // update labelStart on update
  self.field.select("text.rbc-label-start")
      .text(function (item) {
      return item.labelStart;
    });

  // progress
  self.field.select("path.progress")
    .interrupt()
    .transition()
    .duration(self.options.animation.duration)
    .delay(function (d, i) {
      // delay between each item
      return i * self.options.animation.delay;
    })
    .ease("elastic")
    .attrTween("d", function (item) {
      var interpolator = d3.interpolateNumber(item.fromPercentage, item.percentage);
      return function (t) {
        item.percentage = interpolator(t);
        return self.progress(item);
      };
    })
    .tween("center", function (item) {
      // Execute callbacks on each line
      if (self.options.center) {
        var interpolate = self.options.round ? d3.interpolateRound : d3.interpolateNumber;
        var interpolator = interpolate(item.previousValue || 0, item.value);
        return function (t) {
          center
            .selectAll('tspan')
            .each(function () {
              if (this.callback) {
                d3.select(this).text(this.callback(interpolator(t), item.index, item));
              }
            });
        };
      }
    })
    .tween("interpolate-color", function (item) {
      if (item.color.interpolate && item.color.interpolate.length == 2) {
        var colorInterpolator = d3.interpolateHsl(item.color.interpolate[0], item.color.interpolate[1]);

        return function (t) {
          var color = colorInterpolator(item.percentage / 100);
          d3.select(this).style('fill', color);
          d3.select(this.parentNode).select('path.bg').style('fill', color);
        };
      }
    })
    .style("fill", function (item) {
      if (item.color.solid) {
        return item.color.solid;
      }

      if (item.color.linearGradient || item.color.radialGradient) {
        return "url(#gradient" + item.index + ')';
      }
    });
};

/**
 * Remove svg and clean some references
 */
RadialProgressChart.prototype.destroy = function () {
  this.svg.remove();
  delete this.svg;
};

/**
 * Detach and normalize user's options input.
 */
RadialProgressChart.normalizeOptions = function (options) {
  if (!options || typeof options !== 'object') {
    options = {};
  }

  var _options = {
    diameter: options.diameter || 100,
    stroke: {
      width: options.stroke && options.stroke.width || 40,
      gap: options.stroke && options.stroke.gap || 2
    },
    shadow: {
      width: (!options.shadow || options.shadow.width === null) ? 4 : options.shadow.width
    },
    animation: {
      duration: options.animation && options.animation.duration || 1750,
      delay: options.animation && options.animation.delay || 200
    },
    min: options.min || 0,
    max: options.max || 100,
    round: options.round !== undefined ? !!options.round : true,
    series: options.series || [],
    center: RadialProgressChart.normalizeCenter(options.center),
  };

  var defaultColorsIterator = new RadialProgressChart.ColorsIterator();
  for (var i = 0, length = _options.series.length; i < length; i++) {
    var item = options.series[i];

    // convert number to object
    if (typeof item === 'number') {
      item = {value: item};
    }

    _options.series[i] = {
      index: i,
      value: item.value,
      labelStart: item.labelStart,
      fill: item.fill || '#00000',
      reverse: item.reverse || false,
      color: RadialProgressChart.normalizeColor(item.color, defaultColorsIterator)
    };
  }

  return _options;
};

/**
 * Normalize different notations of color property
 *
 * @param {String|Array|Object} color
 * @example '#fe08b5'
 * @example { solid: '#fe08b5', background: '#000000' }
 * @example ['#000000', '#ff0000']
 * @example {
                linearGradient: { x1: '0%', y1: '100%', x2: '50%', y2: '0%'},
                stops: [
                  {offset: '0%', 'stop-color': '#fe08b5', 'stop-opacity': 1},
                  {offset: '100%', 'stop-color': '#ff1410', 'stop-opacity': 1}
                ]
              }
 * @example {
                radialGradient: {cx: '60', cy: '60', r: '50'},
                stops: [
                  {offset: '0%', 'stop-color': '#fe08b5', 'stop-opacity': 1},
                  {offset: '100%', 'stop-color': '#ff1410', 'stop-opacity': 1}
                ]
              }
 *
 */
RadialProgressChart.normalizeColor = function (color, defaultColorsIterator) {

  if (!color) {
    color = {solid: defaultColorsIterator.next()};
  } else if (typeof color === 'string') {
    color = {solid: color};
  } else if (Array.isArray(color)) {
    color = {interpolate: color};
  } else if (typeof color === 'object') {
    if (!color.solid && !color.interpolate && !color.linearGradient && !color.radialGradient) {
      color.solid = defaultColorsIterator.next();
    }
  }

  // Validate interpolate syntax
  if (color.interpolate) {
    if (color.interpolate.length !== 2) {
      throw new Error('interpolate array should contain two colors');
    }
  }

  // Validate gradient syntax
  if (color.linearGradient || color.radialGradient) {
    if (!color.stops || !Array.isArray(color.stops) || color.stops.length !== 2) {
      throw new Error('gradient syntax is malformed');
    }
  }

  // Set background when is not provided
  if (!color.background) {
    if (color.solid) {
      color.background = color.solid;
    } else if (color.interpolate) {
      color.background = color.interpolate[0];
    } else if (color.linearGradient || color.radialGradient) {
      color.background = color.stops[0]['stop-color'];
    }
  }

  return color;

};


/**
 * Normalize different notations of center property
 *
 * @param {String|Array|Function|Object} center
 * @example 'foo bar'
 * @example { content: 'foo bar', x: 10, y: 4 }
 * @example function(value, index, item) {}
 * @example ['foo bar', function(value, index, item) {}]
 */
RadialProgressChart.normalizeCenter = function (center) {
  if (!center) return null;

  // Convert to object notation
  if (center.constructor !== Object) {
    center = {content: center};
  }

  // Defaults
  center.content = center.content || [];
  center.x = center.x || 0;
  center.y = center.y || 0;

  // Convert content to array notation
  if (!Array.isArray(center.content)) {
    center.content = [center.content];
  }

  return center;
};

// Linear or Radial Gradient internal object
RadialProgressChart.Gradient = (function () {
  function Gradient() {
  }

  Gradient.toSVGElement = function (id, options) {
    var gradientType = options.linearGradient ? 'linearGradient' : 'radialGradient';
    var gradient = d3.select(document.createElementNS(d3.ns.prefix.svg, gradientType))
      .attr(options[gradientType])
      .attr('id', id);

    options.stops.forEach(function (stopAttrs) {
      gradient.append("svg:stop").attr(stopAttrs);
    });

    this.background = options.stops[0]['stop-color'];

    return gradient.node();
  };

  return Gradient;
})();

// Default colors iterator
RadialProgressChart.ColorsIterator = (function () {

  ColorsIterator.DEFAULT_COLORS = ["#1ad5de", "#a0ff03", "#e90b3a", '#ff9500', '#007aff', '#ffcc00', '#5856d6', '#8e8e93'];

  function ColorsIterator() {
    this.index = 0;
  }

  ColorsIterator.prototype.next = function () {
    if (this.index === ColorsIterator.DEFAULT_COLORS.length) {
      this.index = 0;
    }

    return ColorsIterator.DEFAULT_COLORS[this.index++];
  };

  return ColorsIterator;
})();


// Export RadialProgressChart object
if (typeof module !== "undefined")module.exports = RadialProgressChart;
},{"d3":undefined}]},{},[1])(1)
});
//# sourceMappingURL=data:application/json;charset:utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJpbmRleC5qcyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTtBQ0FBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSIsImZpbGUiOiJnZW5lcmF0ZWQuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlc0NvbnRlbnQiOlsiKGZ1bmN0aW9uIGUodCxuLHIpe2Z1bmN0aW9uIHMobyx1KXtpZighbltvXSl7aWYoIXRbb10pe3ZhciBhPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7aWYoIXUmJmEpcmV0dXJuIGEobywhMCk7aWYoaSlyZXR1cm4gaShvLCEwKTt2YXIgZj1uZXcgRXJyb3IoXCJDYW5ub3QgZmluZCBtb2R1bGUgJ1wiK28rXCInXCIpO3Rocm93IGYuY29kZT1cIk1PRFVMRV9OT1RfRk9VTkRcIixmfXZhciBsPW5bb109e2V4cG9ydHM6e319O3Rbb11bMF0uY2FsbChsLmV4cG9ydHMsZnVuY3Rpb24oZSl7dmFyIG49dFtvXVsxXVtlXTtyZXR1cm4gcyhuP246ZSl9LGwsbC5leHBvcnRzLGUsdCxuLHIpfXJldHVybiBuW29dLmV4cG9ydHN9dmFyIGk9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtmb3IodmFyIG89MDtvPHIubGVuZ3RoO28rKylzKHJbb10pO3JldHVybiBzfSkiLCIndXNlIHN0cmljdCc7XG5cbnZhciBkMztcblxuLy8gUmFkaWFsUHJvZ3Jlc3NDaGFydCBvYmplY3RcbmZ1bmN0aW9uIFJhZGlhbFByb2dyZXNzQ2hhcnQocXVlcnksIG9wdGlvbnMpIHtcblxuICAvLyB2ZXJpZnkgZDMgaXMgbG9hZGVkXG4gIGQzID0gKHR5cGVvZiB3aW5kb3cgIT09ICd1bmRlZmluZWQnICYmIHdpbmRvdy5kMykgPyB3aW5kb3cuZDMgOiB0eXBlb2YgcmVxdWlyZSAhPT0gJ3VuZGVmaW5lZCcgPyByZXF1aXJlKFwiZDNcIikgOiB1bmRlZmluZWQ7XG4gIGlmKCFkMykgdGhyb3cgbmV3IEVycm9yKCdkMyBvYmplY3QgaXMgbWlzc2luZy4gRDMuanMgbGlicmFyeSBoYXMgdG8gYmUgbG9hZGVkIGJlZm9yZS4nKTtcblxuICB2YXIgc2VsZiA9IHRoaXM7XG4gIHNlbGYub3B0aW9ucyA9IFJhZGlhbFByb2dyZXNzQ2hhcnQubm9ybWFsaXplT3B0aW9ucyhvcHRpb25zKTtcblxuICAvLyBpbnRlcm5hbCAgdmFyaWFibGVzXG4gIHZhciBzZXJpZXMgPSBzZWxmLm9wdGlvbnMuc2VyaWVzXG4gICAgLCB3aWR0aCA9IDE1ICsgKChzZWxmLm9wdGlvbnMuZGlhbWV0ZXIgLyAyKSArIChzZWxmLm9wdGlvbnMuc3Ryb2tlLndpZHRoICogc2VsZi5vcHRpb25zLnNlcmllcy5sZW5ndGgpICsgKHNlbGYub3B0aW9ucy5zdHJva2UuZ2FwICogc2VsZi5vcHRpb25zLnNlcmllcy5sZW5ndGggLSAxKSkgKiAyXG4gICAgLCBoZWlnaHQgPSB3aWR0aFxuICAgICwgZGltID0gXCIwIDAgXCIgKyBoZWlnaHQgKyBcIiBcIiArIHdpZHRoXG4gICAgLCDPhCA9IDIgKiBNYXRoLlBJXG4gICAgLCBpbm5lciA9IFtdXG4gICAgLCBvdXRlciA9IFtdO1xuXG4gIGZ1bmN0aW9uIGlubmVyUmFkaXVzKGl0ZW0pIHtcbiAgICB2YXIgcmFkaXVzID0gaW5uZXJbaXRlbS5pbmRleF07XG4gICAgaWYgKHJhZGl1cykgcmV0dXJuIHJhZGl1cztcblxuICAgIC8vIGZpcnN0IHJpbmcgYmFzZWQgb24gZGlhbWV0ZXIgYW5kIHRoZSByZXN0IGJhc2VkIG9uIHRoZSBwcmV2aW91cyBvdXRlciByYWRpdXMgcGx1cyBnYXBcbiAgICByYWRpdXMgPSBpdGVtLmluZGV4ID09PSAwID8gc2VsZi5vcHRpb25zLmRpYW1ldGVyIC8gMiA6IG91dGVyW2l0ZW0uaW5kZXggLSAxXSArIHNlbGYub3B0aW9ucy5zdHJva2UuZ2FwO1xuICAgIGlubmVyW2l0ZW0uaW5kZXhdID0gcmFkaXVzO1xuICAgIHJldHVybiByYWRpdXM7XG4gIH1cblxuICBmdW5jdGlvbiBvdXRlclJhZGl1cyhpdGVtKSB7XG4gICAgdmFyIHJhZGl1cyA9IG91dGVyW2l0ZW0uaW5kZXhdO1xuICAgIGlmIChyYWRpdXMpIHJldHVybiByYWRpdXM7XG5cbiAgICAvLyBiYXNlZCBvbiB0aGUgcHJldmlvdXMgaW5uZXIgcmFkaXVzICsgc3Ryb2tlIHdpZHRoXG4gICAgcmFkaXVzID0gaW5uZXJbaXRlbS5pbmRleF0gKyBzZWxmLm9wdGlvbnMuc3Ryb2tlLndpZHRoO1xuICAgIG91dGVyW2l0ZW0uaW5kZXhdID0gcmFkaXVzO1xuICAgIHJldHVybiByYWRpdXM7XG4gIH1cblxuICBzZWxmLnByb2dyZXNzID0gZDMuc3ZnLmFyYygpXG4gICAgLy8gLnN0YXJ0QW5nbGUoMClcbiAgICAvLyAuZW5kQW5nbGUoZnVuY3Rpb24gKGl0ZW0pIHtcbiAgICAvLyAgIHJldHVybiBpdGVtLnBlcmNlbnRhZ2UgLyAxMDAgKiDPhDtcbiAgICAvLyB9KVxuXG4gICAgLnN0YXJ0QW5nbGUoZnVuY3Rpb24oaXRlbSkge1xuICAgICAgaWYoaXRlbS5yZXZlcnNlKSB7XG4gICAgICAgIHJldHVybiDPhDtcbiAgICAgIH1cbiAgICAgIHJldHVybiAwO1xuICAgIH0pXG4gICAgLmVuZEFuZ2xlKGZ1bmN0aW9uIChpdGVtKSB7XG4gICAgICBpZihpdGVtLnJldmVyc2UpIHtcbiAgICAgICAgY29uc29sZS5sb2coXCJlbmRcIiwgaXRlbS5sYWJlbFN0YXJ0LCDPhCAtIChpdGVtLnBlcmNlbnRhZ2UgLyAxMDAgKiDPhCkpO1xuICAgICAgICByZXR1cm4gz4QgLSAoaXRlbS5wZXJjZW50YWdlIC8gMTAwICogz4QpO1xuICAgICAgfVxuICAgICAgcmV0dXJuIGl0ZW0ucGVyY2VudGFnZSAvIDEwMCAqIM+EO1xuICAgIH0pXG4gICAgLmlubmVyUmFkaXVzKGlubmVyUmFkaXVzKVxuICAgIC5vdXRlclJhZGl1cyhvdXRlclJhZGl1cylcbiAgICAuY29ybmVyUmFkaXVzKGZ1bmN0aW9uIChkKSB7XG4gICAgICAvLyBXb3JrYXJvdW5kIGZvciBkMyBidWcgaHR0cHM6Ly9naXRodWIuY29tL21ib3N0b2NrL2QzL2lzc3Vlcy8yMjQ5XG4gICAgICAvLyBSZWR1Y2UgY29ybmVyIHJhZGl1cyB3aGVuIGNvcm5lcnMgYXJlIGNsb3NlIGVhY2ggb3RoZXJcbiAgICAgIHZhciBtID0gZC5wZXJjZW50YWdlID49IDkwID8gKDEwMCAtIGQucGVyY2VudGFnZSkgKiAwLjEgOiAxO1xuICAgICAgcmV0dXJuIChzZWxmLm9wdGlvbnMuc3Ryb2tlLndpZHRoIC8gMikgKiBtO1xuICAgIH0pO1xuXG4gIHZhciBiYWNrZ3JvdW5kID0gZDMuc3ZnLmFyYygpXG4gICAgLnN0YXJ0QW5nbGUoMClcbiAgICAuZW5kQW5nbGUoz4QpXG4gICAgLmlubmVyUmFkaXVzKGlubmVyUmFkaXVzKVxuICAgIC5vdXRlclJhZGl1cyhvdXRlclJhZGl1cyk7XG5cbiAgLy8gY3JlYXRlIHN2Z1xuICBzZWxmLnN2ZyA9IGQzLnNlbGVjdChxdWVyeSkuYXBwZW5kKFwic3ZnXCIpXG4gICAgLmF0dHIoXCJwcmVzZXJ2ZUFzcGVjdFJhdGlvXCIsXCJ4TWluWU1pbiBtZWV0XCIpXG4gICAgLmF0dHIoXCJ2aWV3Qm94XCIsIGRpbSlcbiAgICAuYXBwZW5kKFwiZ1wiKVxuICAgIC5hdHRyKFwidHJhbnNmb3JtXCIsIFwidHJhbnNsYXRlKFwiICsgd2lkdGggLyAyICsgXCIsXCIgKyBoZWlnaHQgLyAyICsgXCIpXCIpO1xuXG4gIC8vIGFkZCBncmFkaWVudHMgZGVmc1xuICB2YXIgZGVmcyA9IHNlbGYuc3ZnLmFwcGVuZChcInN2ZzpkZWZzXCIpO1xuICBzZXJpZXMuZm9yRWFjaChmdW5jdGlvbiAoaXRlbSkge1xuICAgIGlmIChpdGVtLmNvbG9yLmxpbmVhckdyYWRpZW50IHx8IGl0ZW0uY29sb3IucmFkaWFsR3JhZGllbnQpIHtcbiAgICAgIHZhciBncmFkaWVudCA9IFJhZGlhbFByb2dyZXNzQ2hhcnQuR3JhZGllbnQudG9TVkdFbGVtZW50KCdncmFkaWVudCcgKyBpdGVtLmluZGV4LCBpdGVtLmNvbG9yKTtcbiAgICAgIGRlZnMubm9kZSgpLmFwcGVuZENoaWxkKGdyYWRpZW50KTtcbiAgICB9XG4gIH0pO1xuXG4gIC8vIGFkZCBzaGFkb3dzIGRlZnNcbiAgZGVmcyA9IHNlbGYuc3ZnLmFwcGVuZChcInN2ZzpkZWZzXCIpO1xuICB2YXIgZHJvcHNoYWRvd0lkID0gXCJkcm9wc2hhZG93LVwiICsgTWF0aC5yYW5kb20oKTtcbiAgdmFyIGZpbHRlciA9IGRlZnMuYXBwZW5kKFwiZmlsdGVyXCIpLmF0dHIoXCJpZFwiLCBkcm9wc2hhZG93SWQpO1xuICBpZihzZWxmLm9wdGlvbnMuc2hhZG93LndpZHRoID4gMCkge1xuICAgIFxuICAgIGZpbHRlci5hcHBlbmQoXCJmZUdhdXNzaWFuQmx1clwiKVxuICAgICAgLmF0dHIoXCJpblwiLCBcIlNvdXJjZUFscGhhXCIpXG4gICAgICAuYXR0cihcInN0ZERldmlhdGlvblwiLCBzZWxmLm9wdGlvbnMuc2hhZG93LndpZHRoKVxuICAgICAgLmF0dHIoXCJyZXN1bHRcIiwgXCJibHVyXCIpO1xuXG4gICAgZmlsdGVyLmFwcGVuZChcImZlT2Zmc2V0XCIpXG4gICAgICAuYXR0cihcImluXCIsIFwiYmx1clwiKVxuICAgICAgLmF0dHIoXCJkeFwiLCAxKVxuICAgICAgLmF0dHIoXCJkeVwiLCAxKVxuICAgICAgLmF0dHIoXCJyZXN1bHRcIiwgXCJvZmZzZXRCbHVyXCIpO1xuICB9XG5cbiAgdmFyIGZlTWVyZ2UgPSBmaWx0ZXIuYXBwZW5kKFwiZmVNZXJnZVwiKTtcbiAgZmVNZXJnZS5hcHBlbmQoXCJmZU1lcmdlTm9kZVwiKS5hdHRyKFwiaW5cIiwgXCJvZmZzZXRCbHVyXCIpO1xuICBmZU1lcmdlLmFwcGVuZChcImZlTWVyZ2VOb2RlXCIpLmF0dHIoXCJpblwiLCBcIlNvdXJjZUdyYXBoaWNcIik7XG5cbiAgLy8gYWRkIGlubmVyIHRleHRcbiAgaWYgKHNlbGYub3B0aW9ucy5jZW50ZXIpIHtcbiAgICBzZWxmLnN2Zy5hcHBlbmQoXCJ0ZXh0XCIpXG4gICAgICAuYXR0cignY2xhc3MnLCAncmJjLWNlbnRlci10ZXh0JylcbiAgICAgIC5hdHRyKFwidGV4dC1hbmNob3JcIiwgXCJtaWRkbGVcIilcbiAgICAgIC5hdHRyKCd4Jywgc2VsZi5vcHRpb25zLmNlbnRlci54ICsgJ3B4JylcbiAgICAgIC5hdHRyKCd5Jywgc2VsZi5vcHRpb25zLmNlbnRlci55ICsgJ3B4JylcbiAgICAgIC5zZWxlY3RBbGwoJ3RzcGFuJylcbiAgICAgIC5kYXRhKHNlbGYub3B0aW9ucy5jZW50ZXIuY29udGVudCkuZW50ZXIoKVxuICAgICAgLmFwcGVuZCgndHNwYW4nKVxuICAgICAgLmF0dHIoXCJkb21pbmFudC1iYXNlbGluZVwiLCBmdW5jdGlvbiAoKSB7XG5cbiAgICAgICAgLy8gU2luZ2xlIGxpbmVzIGNhbiBlYXNpbHkgY2VudGVyZWQgaW4gdGhlIG1pZGRsZSB1c2luZyBkb21pbmFudC1iYXNlbGluZSwgbXVsdGlsaW5lIG5lZWQgdG8gdXNlIHlcbiAgICAgICAgaWYgKHNlbGYub3B0aW9ucy5jZW50ZXIuY29udGVudC5sZW5ndGggPT09IDEpIHtcbiAgICAgICAgICByZXR1cm4gJ2NlbnRyYWwnO1xuICAgICAgICB9XG4gICAgICB9KVxuICAgICAgLmF0dHIoJ2NsYXNzJywgZnVuY3Rpb24gKGQsIGkpIHtcbiAgICAgICAgcmV0dXJuICdyYmMtY2VudGVyLXRleHQtbGluZScgKyBpO1xuICAgICAgfSlcbiAgICAgIC5hdHRyKCd4JywgMClcbiAgICAgIC5hdHRyKCdkeScsIGZ1bmN0aW9uIChkLCBpKSB7XG4gICAgICAgIGlmIChpID4gMCkge1xuICAgICAgICAgIHJldHVybiAnMS4xZW0nO1xuICAgICAgICB9XG4gICAgICB9KVxuICAgICAgLmVhY2goZnVuY3Rpb24gKGQpIHtcbiAgICAgICAgaWYgKHR5cGVvZiBkID09PSAnZnVuY3Rpb24nKSB7XG4gICAgICAgICAgdGhpcy5jYWxsYmFjayA9IGQ7XG4gICAgICAgIH1cbiAgICAgIH0pXG4gICAgICAudGV4dChmdW5jdGlvbiAoZCkge1xuICAgICAgICBpZiAodHlwZW9mIGQgPT09ICdzdHJpbmcnKSB7XG4gICAgICAgICAgcmV0dXJuIGQ7XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gJyc7XG4gICAgICB9KTtcbiAgfVxuXG4gIC8vIGFkZCByaW5nIHN0cnVjdHVyZVxuICBzZWxmLmZpZWxkID0gc2VsZi5zdmcuc2VsZWN0QWxsKFwiZ1wiKVxuICAgIC5kYXRhKHNlcmllcylcbiAgICAuZW50ZXIoKS5hcHBlbmQoXCJnXCIpO1xuXG4gIHNlbGYuZmllbGQuYXBwZW5kKFwicGF0aFwiKS5hdHRyKFwiY2xhc3NcIiwgXCJwcm9ncmVzc1wiKS5hdHRyKFwiZmlsdGVyXCIsIFwidXJsKCNcIiArIGRyb3BzaGFkb3dJZCArXCIpXCIpXG4gICAgLnN0eWxlKFwic3Ryb2tlLXdpZHRoXCIsIDUpXG4gICAgLnN0eWxlKFwic3Ryb2tlXCIsIFwid2hpdGVcIik7XG5cbiAgc2VsZi5maWVsZC5hcHBlbmQoXCJwYXRoXCIpLmF0dHIoXCJjbGFzc1wiLCBcImJnXCIpXG4gICAgLnN0eWxlKFwiZmlsbFwiLCBmdW5jdGlvbiAoaXRlbSkge1xuICAgICAgcmV0dXJuIGl0ZW0uY29sb3IuYmFja2dyb3VuZDtcbiAgICB9KVxuICAgIC5zdHlsZShcIm9wYWNpdHlcIiwgMC4yKVxuICAgIC5hdHRyKFwiZFwiLCBiYWNrZ3JvdW5kKTtcblxuICBzZWxmLmZpZWxkLmFwcGVuZChcInRleHRcIilcbiAgICAuY2xhc3NlZCgncmJjLWxhYmVsIHJiYy1sYWJlbC1zdGFydCcsIHRydWUpXG4gICAgLmF0dHIoXCJkb21pbmFudC1iYXNlbGluZVwiLCBcImNlbnRyYWxcIilcbiAgICAuYXR0cihcInhcIiwgXCIxMFwiKVxuICAgIC5hdHRyKFwieVwiLCBmdW5jdGlvbiAoaXRlbSkge1xuICAgICAgcmV0dXJuIC0oXG4gICAgICAgIHNlbGYub3B0aW9ucy5kaWFtZXRlciAvIDIgK1xuICAgICAgICBpdGVtLmluZGV4ICogKHNlbGYub3B0aW9ucy5zdHJva2UuZ2FwICsgc2VsZi5vcHRpb25zLnN0cm9rZS53aWR0aCkgK1xuICAgICAgICBzZWxmLm9wdGlvbnMuc3Ryb2tlLndpZHRoIC8gMlxuICAgICAgICApO1xuICAgIH0pXG4gICAgLnN0eWxlKFwiZmlsbFwiLCBmdW5jdGlvbihpdGVtKSB7XG4gICAgICAgIHJldHVybiBpdGVtLmZpbGw7XG4gICAgfSlcbiAgICAudGV4dChmdW5jdGlvbiAoaXRlbSkge1xuICAgICAgcmV0dXJuIGl0ZW0ubGFiZWxTdGFydDtcbiAgICB9KTtcblxuICBzZWxmLnVwZGF0ZSgpO1xufVxuXG4vKipcbiAqIFVwZGF0ZSBkYXRhIHRvIGJlIHZpc3VhbGl6ZWQgaW4gdGhlIGNoYXJ0LlxuICpcbiAqIEBwYXJhbSB7T2JqZWN0fEFycmF5fSBkYXRhIE9wdGlvbmFsIGRhdGEgeW91J2QgbGlrZSB0byBzZXQgZm9yIHRoZSBjaGFydCBiZWZvcmUgaXQgd2lsbCB1cGRhdGUuIElmIG5vdCBzcGVjaWZpZWQgdGhlIHVwZGF0ZSBtZXRob2Qgd2lsbCB1c2UgdGhlIGRhdGEgdGhhdCBpcyBhbHJlYWR5IGNvbmZpZ3VyZWQgd2l0aCB0aGUgY2hhcnQuXG4gKiBAZXhhbXBsZSB1cGRhdGUoWzcwLCAxMCwgNDVdKVxuICogQGV4YW1wbGUgdXBkYXRlKHtzZXJpZXM6IFt7dmFsdWU6IDcwfSwgMTAsIDQ1XX0pXG4gKlxuICovXG5SYWRpYWxQcm9ncmVzc0NoYXJ0LnByb3RvdHlwZS51cGRhdGUgPSBmdW5jdGlvbiAoZGF0YSkge1xuICB2YXIgc2VsZiA9IHRoaXM7XG4gIGNvbnNvbGUubG9nKFwidXBkYXRpbmchXCIsIGRhdGEpO1xuXG4gIC8vIHBhcnNlIG5ldyBkYXRhXG4gIGlmIChkYXRhKSB7XG4gICAgaWYgKHR5cGVvZiBkYXRhID09PSAnbnVtYmVyJykge1xuICAgICAgZGF0YSA9IFtkYXRhXTtcbiAgICB9XG5cbiAgICB2YXIgc2VyaWVzO1xuXG4gICAgaWYgKEFycmF5LmlzQXJyYXkoZGF0YSkpIHtcbiAgICAgIHNlcmllcyA9IGRhdGE7XG4gICAgfSBlbHNlIGlmICh0eXBlb2YgZGF0YSA9PT0gJ29iamVjdCcpIHtcbiAgICAgIHNlcmllcyA9IGRhdGEuc2VyaWVzIHx8IFtdO1xuICAgIH1cblxuICAgIGZvciAodmFyIGkgPSAwOyBpIDwgc2VyaWVzLmxlbmd0aDsgaSsrKSB7XG4gICAgICB0aGlzLm9wdGlvbnMuc2VyaWVzW2ldLnByZXZpb3VzVmFsdWUgPSB0aGlzLm9wdGlvbnMuc2VyaWVzW2ldLnZhbHVlO1xuXG4gICAgICB2YXIgaXRlbSA9IHNlcmllc1tpXTtcbiAgICAgIGlmICh0eXBlb2YgaXRlbSA9PT0gJ251bWJlcicpIHtcbiAgICAgICAgdGhpcy5vcHRpb25zLnNlcmllc1tpXS52YWx1ZSA9IGl0ZW07XG4gICAgICB9IGVsc2UgaWYgKHR5cGVvZiBpdGVtID09PSAnb2JqZWN0Jykge1xuICAgICAgICB0aGlzLm9wdGlvbnMuc2VyaWVzW2ldLnZhbHVlID0gaXRlbS52YWx1ZTtcbiAgICAgICAgLy8gdXBkYXRlIGl0ZW0ubGFiZWxTdGFydCB2YWx1ZVxuICAgICAgICBpZihpdGVtLmxhYmVsU3RhcnQpIHtcbiAgICAgICAgICB0aGlzLm9wdGlvbnMuc2VyaWVzW2ldLmxhYmVsU3RhcnQgPSBpdGVtLmxhYmVsU3RhcnQ7IFxuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgLy8gY2FsY3VsYXRlIGZyb20gcGVyY2VudGFnZSBhbmQgbmV3IHBlcmNlbnRhZ2UgZm9yIHRoZSBwcm9ncmVzcyBhbmltYXRpb25cbiAgc2VsZi5vcHRpb25zLnNlcmllcy5mb3JFYWNoKGZ1bmN0aW9uIChpdGVtKSB7XG4gICAgaXRlbS5mcm9tUGVyY2VudGFnZSA9IGl0ZW0ucGVyY2VudGFnZSA/IGl0ZW0ucGVyY2VudGFnZSA6IDU7XG4gICAgaXRlbS5wZXJjZW50YWdlID0gKGl0ZW0udmFsdWUgLSBzZWxmLm9wdGlvbnMubWluKSAqIDEwMCAvIChzZWxmLm9wdGlvbnMubWF4IC0gc2VsZi5vcHRpb25zLm1pbik7XG4gIH0pO1xuXG4gIHZhciBjZW50ZXIgPSBzZWxmLnN2Zy5zZWxlY3QoXCJ0ZXh0LnJiYy1jZW50ZXItdGV4dFwiKTtcblxuICAvLyB1cGRhdGUgbGFiZWxTdGFydCBvbiB1cGRhdGVcbiAgc2VsZi5maWVsZC5zZWxlY3QoXCJ0ZXh0LnJiYy1sYWJlbC1zdGFydFwiKVxuICAgICAgLnRleHQoZnVuY3Rpb24gKGl0ZW0pIHtcbiAgICAgIHJldHVybiBpdGVtLmxhYmVsU3RhcnQ7XG4gICAgfSk7XG5cbiAgLy8gcHJvZ3Jlc3NcbiAgc2VsZi5maWVsZC5zZWxlY3QoXCJwYXRoLnByb2dyZXNzXCIpXG4gICAgLmludGVycnVwdCgpXG4gICAgLnRyYW5zaXRpb24oKVxuICAgIC5kdXJhdGlvbihzZWxmLm9wdGlvbnMuYW5pbWF0aW9uLmR1cmF0aW9uKVxuICAgIC5kZWxheShmdW5jdGlvbiAoZCwgaSkge1xuICAgICAgLy8gZGVsYXkgYmV0d2VlbiBlYWNoIGl0ZW1cbiAgICAgIHJldHVybiBpICogc2VsZi5vcHRpb25zLmFuaW1hdGlvbi5kZWxheTtcbiAgICB9KVxuICAgIC5lYXNlKFwiZWxhc3RpY1wiKVxuICAgIC5hdHRyVHdlZW4oXCJkXCIsIGZ1bmN0aW9uIChpdGVtKSB7XG4gICAgICB2YXIgaW50ZXJwb2xhdG9yID0gZDMuaW50ZXJwb2xhdGVOdW1iZXIoaXRlbS5mcm9tUGVyY2VudGFnZSwgaXRlbS5wZXJjZW50YWdlKTtcbiAgICAgIHJldHVybiBmdW5jdGlvbiAodCkge1xuICAgICAgICBpdGVtLnBlcmNlbnRhZ2UgPSBpbnRlcnBvbGF0b3IodCk7XG4gICAgICAgIHJldHVybiBzZWxmLnByb2dyZXNzKGl0ZW0pO1xuICAgICAgfTtcbiAgICB9KVxuICAgIC50d2VlbihcImNlbnRlclwiLCBmdW5jdGlvbiAoaXRlbSkge1xuICAgICAgLy8gRXhlY3V0ZSBjYWxsYmFja3Mgb24gZWFjaCBsaW5lXG4gICAgICBpZiAoc2VsZi5vcHRpb25zLmNlbnRlcikge1xuICAgICAgICB2YXIgaW50ZXJwb2xhdGUgPSBzZWxmLm9wdGlvbnMucm91bmQgPyBkMy5pbnRlcnBvbGF0ZVJvdW5kIDogZDMuaW50ZXJwb2xhdGVOdW1iZXI7XG4gICAgICAgIHZhciBpbnRlcnBvbGF0b3IgPSBpbnRlcnBvbGF0ZShpdGVtLnByZXZpb3VzVmFsdWUgfHwgMCwgaXRlbS52YWx1ZSk7XG4gICAgICAgIHJldHVybiBmdW5jdGlvbiAodCkge1xuICAgICAgICAgIGNlbnRlclxuICAgICAgICAgICAgLnNlbGVjdEFsbCgndHNwYW4nKVxuICAgICAgICAgICAgLmVhY2goZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgICBpZiAodGhpcy5jYWxsYmFjaykge1xuICAgICAgICAgICAgICAgIGQzLnNlbGVjdCh0aGlzKS50ZXh0KHRoaXMuY2FsbGJhY2soaW50ZXJwb2xhdG9yKHQpLCBpdGVtLmluZGV4LCBpdGVtKSk7XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9O1xuICAgICAgfVxuICAgIH0pXG4gICAgLnR3ZWVuKFwiaW50ZXJwb2xhdGUtY29sb3JcIiwgZnVuY3Rpb24gKGl0ZW0pIHtcbiAgICAgIGlmIChpdGVtLmNvbG9yLmludGVycG9sYXRlICYmIGl0ZW0uY29sb3IuaW50ZXJwb2xhdGUubGVuZ3RoID09IDIpIHtcbiAgICAgICAgdmFyIGNvbG9ySW50ZXJwb2xhdG9yID0gZDMuaW50ZXJwb2xhdGVIc2woaXRlbS5jb2xvci5pbnRlcnBvbGF0ZVswXSwgaXRlbS5jb2xvci5pbnRlcnBvbGF0ZVsxXSk7XG5cbiAgICAgICAgcmV0dXJuIGZ1bmN0aW9uICh0KSB7XG4gICAgICAgICAgdmFyIGNvbG9yID0gY29sb3JJbnRlcnBvbGF0b3IoaXRlbS5wZXJjZW50YWdlIC8gMTAwKTtcbiAgICAgICAgICBkMy5zZWxlY3QodGhpcykuc3R5bGUoJ2ZpbGwnLCBjb2xvcik7XG4gICAgICAgICAgZDMuc2VsZWN0KHRoaXMucGFyZW50Tm9kZSkuc2VsZWN0KCdwYXRoLmJnJykuc3R5bGUoJ2ZpbGwnLCBjb2xvcik7XG4gICAgICAgIH07XG4gICAgICB9XG4gICAgfSlcbiAgICAuc3R5bGUoXCJmaWxsXCIsIGZ1bmN0aW9uIChpdGVtKSB7XG4gICAgICBpZiAoaXRlbS5jb2xvci5zb2xpZCkge1xuICAgICAgICByZXR1cm4gaXRlbS5jb2xvci5zb2xpZDtcbiAgICAgIH1cblxuICAgICAgaWYgKGl0ZW0uY29sb3IubGluZWFyR3JhZGllbnQgfHwgaXRlbS5jb2xvci5yYWRpYWxHcmFkaWVudCkge1xuICAgICAgICByZXR1cm4gXCJ1cmwoI2dyYWRpZW50XCIgKyBpdGVtLmluZGV4ICsgJyknO1xuICAgICAgfVxuICAgIH0pO1xufTtcblxuLyoqXG4gKiBSZW1vdmUgc3ZnIGFuZCBjbGVhbiBzb21lIHJlZmVyZW5jZXNcbiAqL1xuUmFkaWFsUHJvZ3Jlc3NDaGFydC5wcm90b3R5cGUuZGVzdHJveSA9IGZ1bmN0aW9uICgpIHtcbiAgdGhpcy5zdmcucmVtb3ZlKCk7XG4gIGRlbGV0ZSB0aGlzLnN2Zztcbn07XG5cbi8qKlxuICogRGV0YWNoIGFuZCBub3JtYWxpemUgdXNlcidzIG9wdGlvbnMgaW5wdXQuXG4gKi9cblJhZGlhbFByb2dyZXNzQ2hhcnQubm9ybWFsaXplT3B0aW9ucyA9IGZ1bmN0aW9uIChvcHRpb25zKSB7XG4gIGlmICghb3B0aW9ucyB8fCB0eXBlb2Ygb3B0aW9ucyAhPT0gJ29iamVjdCcpIHtcbiAgICBvcHRpb25zID0ge307XG4gIH1cblxuICB2YXIgX29wdGlvbnMgPSB7XG4gICAgZGlhbWV0ZXI6IG9wdGlvbnMuZGlhbWV0ZXIgfHwgMTAwLFxuICAgIHN0cm9rZToge1xuICAgICAgd2lkdGg6IG9wdGlvbnMuc3Ryb2tlICYmIG9wdGlvbnMuc3Ryb2tlLndpZHRoIHx8IDQwLFxuICAgICAgZ2FwOiBvcHRpb25zLnN0cm9rZSAmJiBvcHRpb25zLnN0cm9rZS5nYXAgfHwgMlxuICAgIH0sXG4gICAgc2hhZG93OiB7XG4gICAgICB3aWR0aDogKCFvcHRpb25zLnNoYWRvdyB8fCBvcHRpb25zLnNoYWRvdy53aWR0aCA9PT0gbnVsbCkgPyA0IDogb3B0aW9ucy5zaGFkb3cud2lkdGhcbiAgICB9LFxuICAgIGFuaW1hdGlvbjoge1xuICAgICAgZHVyYXRpb246IG9wdGlvbnMuYW5pbWF0aW9uICYmIG9wdGlvbnMuYW5pbWF0aW9uLmR1cmF0aW9uIHx8IDE3NTAsXG4gICAgICBkZWxheTogb3B0aW9ucy5hbmltYXRpb24gJiYgb3B0aW9ucy5hbmltYXRpb24uZGVsYXkgfHwgMjAwXG4gICAgfSxcbiAgICBtaW46IG9wdGlvbnMubWluIHx8IDAsXG4gICAgbWF4OiBvcHRpb25zLm1heCB8fCAxMDAsXG4gICAgcm91bmQ6IG9wdGlvbnMucm91bmQgIT09IHVuZGVmaW5lZCA/ICEhb3B0aW9ucy5yb3VuZCA6IHRydWUsXG4gICAgc2VyaWVzOiBvcHRpb25zLnNlcmllcyB8fCBbXSxcbiAgICBjZW50ZXI6IFJhZGlhbFByb2dyZXNzQ2hhcnQubm9ybWFsaXplQ2VudGVyKG9wdGlvbnMuY2VudGVyKSxcbiAgfTtcblxuICB2YXIgZGVmYXVsdENvbG9yc0l0ZXJhdG9yID0gbmV3IFJhZGlhbFByb2dyZXNzQ2hhcnQuQ29sb3JzSXRlcmF0b3IoKTtcbiAgZm9yICh2YXIgaSA9IDAsIGxlbmd0aCA9IF9vcHRpb25zLnNlcmllcy5sZW5ndGg7IGkgPCBsZW5ndGg7IGkrKykge1xuICAgIHZhciBpdGVtID0gb3B0aW9ucy5zZXJpZXNbaV07XG5cbiAgICAvLyBjb252ZXJ0IG51bWJlciB0byBvYmplY3RcbiAgICBpZiAodHlwZW9mIGl0ZW0gPT09ICdudW1iZXInKSB7XG4gICAgICBpdGVtID0ge3ZhbHVlOiBpdGVtfTtcbiAgICB9XG5cbiAgICBfb3B0aW9ucy5zZXJpZXNbaV0gPSB7XG4gICAgICBpbmRleDogaSxcbiAgICAgIHZhbHVlOiBpdGVtLnZhbHVlLFxuICAgICAgbGFiZWxTdGFydDogaXRlbS5sYWJlbFN0YXJ0LFxuICAgICAgZmlsbDogaXRlbS5maWxsIHx8wqAnIzAwMDAwJyxcbiAgICAgIHJldmVyc2U6IGl0ZW0ucmV2ZXJzZSB8fMKgZmFsc2UsXG4gICAgICBjb2xvcjogUmFkaWFsUHJvZ3Jlc3NDaGFydC5ub3JtYWxpemVDb2xvcihpdGVtLmNvbG9yLCBkZWZhdWx0Q29sb3JzSXRlcmF0b3IpXG4gICAgfTtcbiAgfVxuXG4gIHJldHVybiBfb3B0aW9ucztcbn07XG5cbi8qKlxuICogTm9ybWFsaXplIGRpZmZlcmVudCBub3RhdGlvbnMgb2YgY29sb3IgcHJvcGVydHlcbiAqXG4gKiBAcGFyYW0ge1N0cmluZ3xBcnJheXxPYmplY3R9IGNvbG9yXG4gKiBAZXhhbXBsZSAnI2ZlMDhiNSdcbiAqIEBleGFtcGxlIHsgc29saWQ6ICcjZmUwOGI1JywgYmFja2dyb3VuZDogJyMwMDAwMDAnIH1cbiAqIEBleGFtcGxlIFsnIzAwMDAwMCcsICcjZmYwMDAwJ11cbiAqIEBleGFtcGxlIHtcbiAgICAgICAgICAgICAgICBsaW5lYXJHcmFkaWVudDogeyB4MTogJzAlJywgeTE6ICcxMDAlJywgeDI6ICc1MCUnLCB5MjogJzAlJ30sXG4gICAgICAgICAgICAgICAgc3RvcHM6IFtcbiAgICAgICAgICAgICAgICAgIHtvZmZzZXQ6ICcwJScsICdzdG9wLWNvbG9yJzogJyNmZTA4YjUnLCAnc3RvcC1vcGFjaXR5JzogMX0sXG4gICAgICAgICAgICAgICAgICB7b2Zmc2V0OiAnMTAwJScsICdzdG9wLWNvbG9yJzogJyNmZjE0MTAnLCAnc3RvcC1vcGFjaXR5JzogMX1cbiAgICAgICAgICAgICAgICBdXG4gICAgICAgICAgICAgIH1cbiAqIEBleGFtcGxlIHtcbiAgICAgICAgICAgICAgICByYWRpYWxHcmFkaWVudDoge2N4OiAnNjAnLCBjeTogJzYwJywgcjogJzUwJ30sXG4gICAgICAgICAgICAgICAgc3RvcHM6IFtcbiAgICAgICAgICAgICAgICAgIHtvZmZzZXQ6ICcwJScsICdzdG9wLWNvbG9yJzogJyNmZTA4YjUnLCAnc3RvcC1vcGFjaXR5JzogMX0sXG4gICAgICAgICAgICAgICAgICB7b2Zmc2V0OiAnMTAwJScsICdzdG9wLWNvbG9yJzogJyNmZjE0MTAnLCAnc3RvcC1vcGFjaXR5JzogMX1cbiAgICAgICAgICAgICAgICBdXG4gICAgICAgICAgICAgIH1cbiAqXG4gKi9cblJhZGlhbFByb2dyZXNzQ2hhcnQubm9ybWFsaXplQ29sb3IgPSBmdW5jdGlvbiAoY29sb3IsIGRlZmF1bHRDb2xvcnNJdGVyYXRvcikge1xuXG4gIGlmICghY29sb3IpIHtcbiAgICBjb2xvciA9IHtzb2xpZDogZGVmYXVsdENvbG9yc0l0ZXJhdG9yLm5leHQoKX07XG4gIH0gZWxzZSBpZiAodHlwZW9mIGNvbG9yID09PSAnc3RyaW5nJykge1xuICAgIGNvbG9yID0ge3NvbGlkOiBjb2xvcn07XG4gIH0gZWxzZSBpZiAoQXJyYXkuaXNBcnJheShjb2xvcikpIHtcbiAgICBjb2xvciA9IHtpbnRlcnBvbGF0ZTogY29sb3J9O1xuICB9IGVsc2UgaWYgKHR5cGVvZiBjb2xvciA9PT0gJ29iamVjdCcpIHtcbiAgICBpZiAoIWNvbG9yLnNvbGlkICYmICFjb2xvci5pbnRlcnBvbGF0ZSAmJiAhY29sb3IubGluZWFyR3JhZGllbnQgJiYgIWNvbG9yLnJhZGlhbEdyYWRpZW50KSB7XG4gICAgICBjb2xvci5zb2xpZCA9IGRlZmF1bHRDb2xvcnNJdGVyYXRvci5uZXh0KCk7XG4gICAgfVxuICB9XG5cbiAgLy8gVmFsaWRhdGUgaW50ZXJwb2xhdGUgc3ludGF4XG4gIGlmIChjb2xvci5pbnRlcnBvbGF0ZSkge1xuICAgIGlmIChjb2xvci5pbnRlcnBvbGF0ZS5sZW5ndGggIT09IDIpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcignaW50ZXJwb2xhdGUgYXJyYXkgc2hvdWxkIGNvbnRhaW4gdHdvIGNvbG9ycycpO1xuICAgIH1cbiAgfVxuXG4gIC8vIFZhbGlkYXRlIGdyYWRpZW50IHN5bnRheFxuICBpZiAoY29sb3IubGluZWFyR3JhZGllbnQgfHwgY29sb3IucmFkaWFsR3JhZGllbnQpIHtcbiAgICBpZiAoIWNvbG9yLnN0b3BzIHx8ICFBcnJheS5pc0FycmF5KGNvbG9yLnN0b3BzKSB8fCBjb2xvci5zdG9wcy5sZW5ndGggIT09IDIpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcignZ3JhZGllbnQgc3ludGF4IGlzIG1hbGZvcm1lZCcpO1xuICAgIH1cbiAgfVxuXG4gIC8vIFNldCBiYWNrZ3JvdW5kIHdoZW4gaXMgbm90IHByb3ZpZGVkXG4gIGlmICghY29sb3IuYmFja2dyb3VuZCkge1xuICAgIGlmIChjb2xvci5zb2xpZCkge1xuICAgICAgY29sb3IuYmFja2dyb3VuZCA9IGNvbG9yLnNvbGlkO1xuICAgIH0gZWxzZSBpZiAoY29sb3IuaW50ZXJwb2xhdGUpIHtcbiAgICAgIGNvbG9yLmJhY2tncm91bmQgPSBjb2xvci5pbnRlcnBvbGF0ZVswXTtcbiAgICB9IGVsc2UgaWYgKGNvbG9yLmxpbmVhckdyYWRpZW50IHx8IGNvbG9yLnJhZGlhbEdyYWRpZW50KSB7XG4gICAgICBjb2xvci5iYWNrZ3JvdW5kID0gY29sb3Iuc3RvcHNbMF1bJ3N0b3AtY29sb3InXTtcbiAgICB9XG4gIH1cblxuICByZXR1cm4gY29sb3I7XG5cbn07XG5cblxuLyoqXG4gKiBOb3JtYWxpemUgZGlmZmVyZW50IG5vdGF0aW9ucyBvZiBjZW50ZXIgcHJvcGVydHlcbiAqXG4gKiBAcGFyYW0ge1N0cmluZ3xBcnJheXxGdW5jdGlvbnxPYmplY3R9IGNlbnRlclxuICogQGV4YW1wbGUgJ2ZvbyBiYXInXG4gKiBAZXhhbXBsZSB7IGNvbnRlbnQ6ICdmb28gYmFyJywgeDogMTAsIHk6IDQgfVxuICogQGV4YW1wbGUgZnVuY3Rpb24odmFsdWUsIGluZGV4LCBpdGVtKSB7fVxuICogQGV4YW1wbGUgWydmb28gYmFyJywgZnVuY3Rpb24odmFsdWUsIGluZGV4LCBpdGVtKSB7fV1cbiAqL1xuUmFkaWFsUHJvZ3Jlc3NDaGFydC5ub3JtYWxpemVDZW50ZXIgPSBmdW5jdGlvbiAoY2VudGVyKSB7XG4gIGlmICghY2VudGVyKSByZXR1cm4gbnVsbDtcblxuICAvLyBDb252ZXJ0IHRvIG9iamVjdCBub3RhdGlvblxuICBpZiAoY2VudGVyLmNvbnN0cnVjdG9yICE9PSBPYmplY3QpIHtcbiAgICBjZW50ZXIgPSB7Y29udGVudDogY2VudGVyfTtcbiAgfVxuXG4gIC8vIERlZmF1bHRzXG4gIGNlbnRlci5jb250ZW50ID0gY2VudGVyLmNvbnRlbnQgfHwgW107XG4gIGNlbnRlci54ID0gY2VudGVyLnggfHwgMDtcbiAgY2VudGVyLnkgPSBjZW50ZXIueSB8fCAwO1xuXG4gIC8vIENvbnZlcnQgY29udGVudCB0byBhcnJheSBub3RhdGlvblxuICBpZiAoIUFycmF5LmlzQXJyYXkoY2VudGVyLmNvbnRlbnQpKSB7XG4gICAgY2VudGVyLmNvbnRlbnQgPSBbY2VudGVyLmNvbnRlbnRdO1xuICB9XG5cbiAgcmV0dXJuIGNlbnRlcjtcbn07XG5cbi8vIExpbmVhciBvciBSYWRpYWwgR3JhZGllbnQgaW50ZXJuYWwgb2JqZWN0XG5SYWRpYWxQcm9ncmVzc0NoYXJ0LkdyYWRpZW50ID0gKGZ1bmN0aW9uICgpIHtcbiAgZnVuY3Rpb24gR3JhZGllbnQoKSB7XG4gIH1cblxuICBHcmFkaWVudC50b1NWR0VsZW1lbnQgPSBmdW5jdGlvbiAoaWQsIG9wdGlvbnMpIHtcbiAgICB2YXIgZ3JhZGllbnRUeXBlID0gb3B0aW9ucy5saW5lYXJHcmFkaWVudCA/ICdsaW5lYXJHcmFkaWVudCcgOiAncmFkaWFsR3JhZGllbnQnO1xuICAgIHZhciBncmFkaWVudCA9IGQzLnNlbGVjdChkb2N1bWVudC5jcmVhdGVFbGVtZW50TlMoZDMubnMucHJlZml4LnN2ZywgZ3JhZGllbnRUeXBlKSlcbiAgICAgIC5hdHRyKG9wdGlvbnNbZ3JhZGllbnRUeXBlXSlcbiAgICAgIC5hdHRyKCdpZCcsIGlkKTtcblxuICAgIG9wdGlvbnMuc3RvcHMuZm9yRWFjaChmdW5jdGlvbiAoc3RvcEF0dHJzKSB7XG4gICAgICBncmFkaWVudC5hcHBlbmQoXCJzdmc6c3RvcFwiKS5hdHRyKHN0b3BBdHRycyk7XG4gICAgfSk7XG5cbiAgICB0aGlzLmJhY2tncm91bmQgPSBvcHRpb25zLnN0b3BzWzBdWydzdG9wLWNvbG9yJ107XG5cbiAgICByZXR1cm4gZ3JhZGllbnQubm9kZSgpO1xuICB9O1xuXG4gIHJldHVybiBHcmFkaWVudDtcbn0pKCk7XG5cbi8vIERlZmF1bHQgY29sb3JzIGl0ZXJhdG9yXG5SYWRpYWxQcm9ncmVzc0NoYXJ0LkNvbG9yc0l0ZXJhdG9yID0gKGZ1bmN0aW9uICgpIHtcblxuICBDb2xvcnNJdGVyYXRvci5ERUZBVUxUX0NPTE9SUyA9IFtcIiMxYWQ1ZGVcIiwgXCIjYTBmZjAzXCIsIFwiI2U5MGIzYVwiLCAnI2ZmOTUwMCcsICcjMDA3YWZmJywgJyNmZmNjMDAnLCAnIzU4NTZkNicsICcjOGU4ZTkzJ107XG5cbiAgZnVuY3Rpb24gQ29sb3JzSXRlcmF0b3IoKSB7XG4gICAgdGhpcy5pbmRleCA9IDA7XG4gIH1cblxuICBDb2xvcnNJdGVyYXRvci5wcm90b3R5cGUubmV4dCA9IGZ1bmN0aW9uICgpIHtcbiAgICBpZiAodGhpcy5pbmRleCA9PT0gQ29sb3JzSXRlcmF0b3IuREVGQVVMVF9DT0xPUlMubGVuZ3RoKSB7XG4gICAgICB0aGlzLmluZGV4ID0gMDtcbiAgICB9XG5cbiAgICByZXR1cm4gQ29sb3JzSXRlcmF0b3IuREVGQVVMVF9DT0xPUlNbdGhpcy5pbmRleCsrXTtcbiAgfTtcblxuICByZXR1cm4gQ29sb3JzSXRlcmF0b3I7XG59KSgpO1xuXG5cbi8vIEV4cG9ydCBSYWRpYWxQcm9ncmVzc0NoYXJ0IG9iamVjdFxuaWYgKHR5cGVvZiBtb2R1bGUgIT09IFwidW5kZWZpbmVkXCIpbW9kdWxlLmV4cG9ydHMgPSBSYWRpYWxQcm9ncmVzc0NoYXJ0OyJdfQ==
