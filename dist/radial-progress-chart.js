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
    .startAngle(0)
    .endAngle(function (item) {
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

  self.field.append("path").attr("class", "progress").attr("filter", "url(#" + dropshadowId +")");

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

    console.log("item color (fill)", self.options.labelStartColor);
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
//# sourceMappingURL=data:application/json;charset:utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJpbmRleC5qcyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTtBQ0FBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EiLCJmaWxlIjoiZ2VuZXJhdGVkLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXNDb250ZW50IjpbIihmdW5jdGlvbiBlKHQsbixyKXtmdW5jdGlvbiBzKG8sdSl7aWYoIW5bb10pe2lmKCF0W29dKXt2YXIgYT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2lmKCF1JiZhKXJldHVybiBhKG8sITApO2lmKGkpcmV0dXJuIGkobywhMCk7dmFyIGY9bmV3IEVycm9yKFwiQ2Fubm90IGZpbmQgbW9kdWxlICdcIitvK1wiJ1wiKTt0aHJvdyBmLmNvZGU9XCJNT0RVTEVfTk9UX0ZPVU5EXCIsZn12YXIgbD1uW29dPXtleHBvcnRzOnt9fTt0W29dWzBdLmNhbGwobC5leHBvcnRzLGZ1bmN0aW9uKGUpe3ZhciBuPXRbb11bMV1bZV07cmV0dXJuIHMobj9uOmUpfSxsLGwuZXhwb3J0cyxlLHQsbixyKX1yZXR1cm4gbltvXS5leHBvcnRzfXZhciBpPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7Zm9yKHZhciBvPTA7bzxyLmxlbmd0aDtvKyspcyhyW29dKTtyZXR1cm4gc30pIiwiJ3VzZSBzdHJpY3QnO1xuXG52YXIgZDM7XG5cbi8vIFJhZGlhbFByb2dyZXNzQ2hhcnQgb2JqZWN0XG5mdW5jdGlvbiBSYWRpYWxQcm9ncmVzc0NoYXJ0KHF1ZXJ5LCBvcHRpb25zKSB7XG5cbiAgLy8gdmVyaWZ5IGQzIGlzIGxvYWRlZFxuICBkMyA9ICh0eXBlb2Ygd2luZG93ICE9PSAndW5kZWZpbmVkJyAmJiB3aW5kb3cuZDMpID8gd2luZG93LmQzIDogdHlwZW9mIHJlcXVpcmUgIT09ICd1bmRlZmluZWQnID8gcmVxdWlyZShcImQzXCIpIDogdW5kZWZpbmVkO1xuICBpZighZDMpIHRocm93IG5ldyBFcnJvcignZDMgb2JqZWN0IGlzIG1pc3NpbmcuIEQzLmpzIGxpYnJhcnkgaGFzIHRvIGJlIGxvYWRlZCBiZWZvcmUuJyk7XG5cbiAgdmFyIHNlbGYgPSB0aGlzO1xuICBzZWxmLm9wdGlvbnMgPSBSYWRpYWxQcm9ncmVzc0NoYXJ0Lm5vcm1hbGl6ZU9wdGlvbnMob3B0aW9ucyk7XG5cbiAgLy8gaW50ZXJuYWwgIHZhcmlhYmxlc1xuICB2YXIgc2VyaWVzID0gc2VsZi5vcHRpb25zLnNlcmllc1xuICAgICwgd2lkdGggPSAxNSArICgoc2VsZi5vcHRpb25zLmRpYW1ldGVyIC8gMikgKyAoc2VsZi5vcHRpb25zLnN0cm9rZS53aWR0aCAqIHNlbGYub3B0aW9ucy5zZXJpZXMubGVuZ3RoKSArIChzZWxmLm9wdGlvbnMuc3Ryb2tlLmdhcCAqIHNlbGYub3B0aW9ucy5zZXJpZXMubGVuZ3RoIC0gMSkpICogMlxuICAgICwgaGVpZ2h0ID0gd2lkdGhcbiAgICAsIGRpbSA9IFwiMCAwIFwiICsgaGVpZ2h0ICsgXCIgXCIgKyB3aWR0aFxuICAgICwgz4QgPSAyICogTWF0aC5QSVxuICAgICwgaW5uZXIgPSBbXVxuICAgICwgb3V0ZXIgPSBbXTtcblxuICBmdW5jdGlvbiBpbm5lclJhZGl1cyhpdGVtKSB7XG4gICAgdmFyIHJhZGl1cyA9IGlubmVyW2l0ZW0uaW5kZXhdO1xuICAgIGlmIChyYWRpdXMpIHJldHVybiByYWRpdXM7XG5cbiAgICAvLyBmaXJzdCByaW5nIGJhc2VkIG9uIGRpYW1ldGVyIGFuZCB0aGUgcmVzdCBiYXNlZCBvbiB0aGUgcHJldmlvdXMgb3V0ZXIgcmFkaXVzIHBsdXMgZ2FwXG4gICAgcmFkaXVzID0gaXRlbS5pbmRleCA9PT0gMCA/IHNlbGYub3B0aW9ucy5kaWFtZXRlciAvIDIgOiBvdXRlcltpdGVtLmluZGV4IC0gMV0gKyBzZWxmLm9wdGlvbnMuc3Ryb2tlLmdhcDtcbiAgICBpbm5lcltpdGVtLmluZGV4XSA9IHJhZGl1cztcbiAgICByZXR1cm4gcmFkaXVzO1xuICB9XG5cbiAgZnVuY3Rpb24gb3V0ZXJSYWRpdXMoaXRlbSkge1xuICAgIHZhciByYWRpdXMgPSBvdXRlcltpdGVtLmluZGV4XTtcbiAgICBpZiAocmFkaXVzKSByZXR1cm4gcmFkaXVzO1xuXG4gICAgLy8gYmFzZWQgb24gdGhlIHByZXZpb3VzIGlubmVyIHJhZGl1cyArIHN0cm9rZSB3aWR0aFxuICAgIHJhZGl1cyA9IGlubmVyW2l0ZW0uaW5kZXhdICsgc2VsZi5vcHRpb25zLnN0cm9rZS53aWR0aDtcbiAgICBvdXRlcltpdGVtLmluZGV4XSA9IHJhZGl1cztcbiAgICByZXR1cm4gcmFkaXVzO1xuICB9XG5cbiAgc2VsZi5wcm9ncmVzcyA9IGQzLnN2Zy5hcmMoKVxuICAgIC5zdGFydEFuZ2xlKDApXG4gICAgLmVuZEFuZ2xlKGZ1bmN0aW9uIChpdGVtKSB7XG4gICAgICByZXR1cm4gaXRlbS5wZXJjZW50YWdlIC8gMTAwICogz4Q7XG4gICAgfSlcbiAgICAuaW5uZXJSYWRpdXMoaW5uZXJSYWRpdXMpXG4gICAgLm91dGVyUmFkaXVzKG91dGVyUmFkaXVzKVxuICAgIC5jb3JuZXJSYWRpdXMoZnVuY3Rpb24gKGQpIHtcbiAgICAgIC8vIFdvcmthcm91bmQgZm9yIGQzIGJ1ZyBodHRwczovL2dpdGh1Yi5jb20vbWJvc3RvY2svZDMvaXNzdWVzLzIyNDlcbiAgICAgIC8vIFJlZHVjZSBjb3JuZXIgcmFkaXVzIHdoZW4gY29ybmVycyBhcmUgY2xvc2UgZWFjaCBvdGhlclxuICAgICAgdmFyIG0gPSBkLnBlcmNlbnRhZ2UgPj0gOTAgPyAoMTAwIC0gZC5wZXJjZW50YWdlKSAqIDAuMSA6IDE7XG4gICAgICByZXR1cm4gKHNlbGYub3B0aW9ucy5zdHJva2Uud2lkdGggLyAyKSAqIG07XG4gICAgfSk7XG5cbiAgdmFyIGJhY2tncm91bmQgPSBkMy5zdmcuYXJjKClcbiAgICAuc3RhcnRBbmdsZSgwKVxuICAgIC5lbmRBbmdsZSjPhClcbiAgICAuaW5uZXJSYWRpdXMoaW5uZXJSYWRpdXMpXG4gICAgLm91dGVyUmFkaXVzKG91dGVyUmFkaXVzKTtcblxuICAvLyBjcmVhdGUgc3ZnXG4gIHNlbGYuc3ZnID0gZDMuc2VsZWN0KHF1ZXJ5KS5hcHBlbmQoXCJzdmdcIilcbiAgICAuYXR0cihcInByZXNlcnZlQXNwZWN0UmF0aW9cIixcInhNaW5ZTWluIG1lZXRcIilcbiAgICAuYXR0cihcInZpZXdCb3hcIiwgZGltKVxuICAgIC5hcHBlbmQoXCJnXCIpXG4gICAgLmF0dHIoXCJ0cmFuc2Zvcm1cIiwgXCJ0cmFuc2xhdGUoXCIgKyB3aWR0aCAvIDIgKyBcIixcIiArIGhlaWdodCAvIDIgKyBcIilcIik7XG5cbiAgLy8gYWRkIGdyYWRpZW50cyBkZWZzXG4gIHZhciBkZWZzID0gc2VsZi5zdmcuYXBwZW5kKFwic3ZnOmRlZnNcIik7XG4gIHNlcmllcy5mb3JFYWNoKGZ1bmN0aW9uIChpdGVtKSB7XG4gICAgaWYgKGl0ZW0uY29sb3IubGluZWFyR3JhZGllbnQgfHwgaXRlbS5jb2xvci5yYWRpYWxHcmFkaWVudCkge1xuICAgICAgdmFyIGdyYWRpZW50ID0gUmFkaWFsUHJvZ3Jlc3NDaGFydC5HcmFkaWVudC50b1NWR0VsZW1lbnQoJ2dyYWRpZW50JyArIGl0ZW0uaW5kZXgsIGl0ZW0uY29sb3IpO1xuICAgICAgZGVmcy5ub2RlKCkuYXBwZW5kQ2hpbGQoZ3JhZGllbnQpO1xuICAgIH1cbiAgfSk7XG5cbiAgLy8gYWRkIHNoYWRvd3MgZGVmc1xuICBkZWZzID0gc2VsZi5zdmcuYXBwZW5kKFwic3ZnOmRlZnNcIik7XG4gIHZhciBkcm9wc2hhZG93SWQgPSBcImRyb3BzaGFkb3ctXCIgKyBNYXRoLnJhbmRvbSgpO1xuICB2YXIgZmlsdGVyID0gZGVmcy5hcHBlbmQoXCJmaWx0ZXJcIikuYXR0cihcImlkXCIsIGRyb3BzaGFkb3dJZCk7XG4gIGlmKHNlbGYub3B0aW9ucy5zaGFkb3cud2lkdGggPiAwKSB7XG4gICAgXG4gICAgZmlsdGVyLmFwcGVuZChcImZlR2F1c3NpYW5CbHVyXCIpXG4gICAgICAuYXR0cihcImluXCIsIFwiU291cmNlQWxwaGFcIilcbiAgICAgIC5hdHRyKFwic3RkRGV2aWF0aW9uXCIsIHNlbGYub3B0aW9ucy5zaGFkb3cud2lkdGgpXG4gICAgICAuYXR0cihcInJlc3VsdFwiLCBcImJsdXJcIik7XG5cbiAgICBmaWx0ZXIuYXBwZW5kKFwiZmVPZmZzZXRcIilcbiAgICAgIC5hdHRyKFwiaW5cIiwgXCJibHVyXCIpXG4gICAgICAuYXR0cihcImR4XCIsIDEpXG4gICAgICAuYXR0cihcImR5XCIsIDEpXG4gICAgICAuYXR0cihcInJlc3VsdFwiLCBcIm9mZnNldEJsdXJcIik7XG4gIH1cblxuICB2YXIgZmVNZXJnZSA9IGZpbHRlci5hcHBlbmQoXCJmZU1lcmdlXCIpO1xuICBmZU1lcmdlLmFwcGVuZChcImZlTWVyZ2VOb2RlXCIpLmF0dHIoXCJpblwiLCBcIm9mZnNldEJsdXJcIik7XG4gIGZlTWVyZ2UuYXBwZW5kKFwiZmVNZXJnZU5vZGVcIikuYXR0cihcImluXCIsIFwiU291cmNlR3JhcGhpY1wiKTtcblxuICAvLyBhZGQgaW5uZXIgdGV4dFxuICBpZiAoc2VsZi5vcHRpb25zLmNlbnRlcikge1xuICAgIHNlbGYuc3ZnLmFwcGVuZChcInRleHRcIilcbiAgICAgIC5hdHRyKCdjbGFzcycsICdyYmMtY2VudGVyLXRleHQnKVxuICAgICAgLmF0dHIoXCJ0ZXh0LWFuY2hvclwiLCBcIm1pZGRsZVwiKVxuICAgICAgLmF0dHIoJ3gnLCBzZWxmLm9wdGlvbnMuY2VudGVyLnggKyAncHgnKVxuICAgICAgLmF0dHIoJ3knLCBzZWxmLm9wdGlvbnMuY2VudGVyLnkgKyAncHgnKVxuICAgICAgLnNlbGVjdEFsbCgndHNwYW4nKVxuICAgICAgLmRhdGEoc2VsZi5vcHRpb25zLmNlbnRlci5jb250ZW50KS5lbnRlcigpXG4gICAgICAuYXBwZW5kKCd0c3BhbicpXG4gICAgICAuYXR0cihcImRvbWluYW50LWJhc2VsaW5lXCIsIGZ1bmN0aW9uICgpIHtcblxuICAgICAgICAvLyBTaW5nbGUgbGluZXMgY2FuIGVhc2lseSBjZW50ZXJlZCBpbiB0aGUgbWlkZGxlIHVzaW5nIGRvbWluYW50LWJhc2VsaW5lLCBtdWx0aWxpbmUgbmVlZCB0byB1c2UgeVxuICAgICAgICBpZiAoc2VsZi5vcHRpb25zLmNlbnRlci5jb250ZW50Lmxlbmd0aCA9PT0gMSkge1xuICAgICAgICAgIHJldHVybiAnY2VudHJhbCc7XG4gICAgICAgIH1cbiAgICAgIH0pXG4gICAgICAuYXR0cignY2xhc3MnLCBmdW5jdGlvbiAoZCwgaSkge1xuICAgICAgICByZXR1cm4gJ3JiYy1jZW50ZXItdGV4dC1saW5lJyArIGk7XG4gICAgICB9KVxuICAgICAgLmF0dHIoJ3gnLCAwKVxuICAgICAgLmF0dHIoJ2R5JywgZnVuY3Rpb24gKGQsIGkpIHtcbiAgICAgICAgaWYgKGkgPiAwKSB7XG4gICAgICAgICAgcmV0dXJuICcxLjFlbSc7XG4gICAgICAgIH1cbiAgICAgIH0pXG4gICAgICAuZWFjaChmdW5jdGlvbiAoZCkge1xuICAgICAgICBpZiAodHlwZW9mIGQgPT09ICdmdW5jdGlvbicpIHtcbiAgICAgICAgICB0aGlzLmNhbGxiYWNrID0gZDtcbiAgICAgICAgfVxuICAgICAgfSlcbiAgICAgIC50ZXh0KGZ1bmN0aW9uIChkKSB7XG4gICAgICAgIGlmICh0eXBlb2YgZCA9PT0gJ3N0cmluZycpIHtcbiAgICAgICAgICByZXR1cm4gZDtcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiAnJztcbiAgICAgIH0pO1xuICB9XG5cbiAgLy8gYWRkIHJpbmcgc3RydWN0dXJlXG4gIHNlbGYuZmllbGQgPSBzZWxmLnN2Zy5zZWxlY3RBbGwoXCJnXCIpXG4gICAgLmRhdGEoc2VyaWVzKVxuICAgIC5lbnRlcigpLmFwcGVuZChcImdcIik7XG5cbiAgc2VsZi5maWVsZC5hcHBlbmQoXCJwYXRoXCIpLmF0dHIoXCJjbGFzc1wiLCBcInByb2dyZXNzXCIpLmF0dHIoXCJmaWx0ZXJcIiwgXCJ1cmwoI1wiICsgZHJvcHNoYWRvd0lkICtcIilcIik7XG5cbiAgc2VsZi5maWVsZC5hcHBlbmQoXCJwYXRoXCIpLmF0dHIoXCJjbGFzc1wiLCBcImJnXCIpXG4gICAgLnN0eWxlKFwiZmlsbFwiLCBmdW5jdGlvbiAoaXRlbSkge1xuICAgICAgcmV0dXJuIGl0ZW0uY29sb3IuYmFja2dyb3VuZDtcbiAgICB9KVxuICAgIC5zdHlsZShcIm9wYWNpdHlcIiwgMC4yKVxuICAgIC5hdHRyKFwiZFwiLCBiYWNrZ3JvdW5kKTtcblxuICBzZWxmLmZpZWxkLmFwcGVuZChcInRleHRcIilcbiAgICAuY2xhc3NlZCgncmJjLWxhYmVsIHJiYy1sYWJlbC1zdGFydCcsIHRydWUpXG4gICAgLmF0dHIoXCJkb21pbmFudC1iYXNlbGluZVwiLCBcImNlbnRyYWxcIilcbiAgICAuYXR0cihcInhcIiwgXCIxMFwiKVxuICAgIC5hdHRyKFwieVwiLCBmdW5jdGlvbiAoaXRlbSkge1xuICAgICAgcmV0dXJuIC0oXG4gICAgICAgIHNlbGYub3B0aW9ucy5kaWFtZXRlciAvIDIgK1xuICAgICAgICBpdGVtLmluZGV4ICogKHNlbGYub3B0aW9ucy5zdHJva2UuZ2FwICsgc2VsZi5vcHRpb25zLnN0cm9rZS53aWR0aCkgK1xuICAgICAgICBzZWxmLm9wdGlvbnMuc3Ryb2tlLndpZHRoIC8gMlxuICAgICAgICApO1xuICAgIH0pXG4gICAgLnN0eWxlKFwiZmlsbFwiLCBmdW5jdGlvbihpdGVtKSB7XG4gICAgICAgIHJldHVybiBpdGVtLmZpbGw7XG4gICAgfSlcbiAgICAudGV4dChmdW5jdGlvbiAoaXRlbSkge1xuICAgICAgcmV0dXJuIGl0ZW0ubGFiZWxTdGFydDtcbiAgICB9KTtcblxuICAgIGNvbnNvbGUubG9nKFwiaXRlbSBjb2xvciAoZmlsbClcIiwgc2VsZi5vcHRpb25zLmxhYmVsU3RhcnRDb2xvcik7XG4gIHNlbGYudXBkYXRlKCk7XG59XG5cbi8qKlxuICogVXBkYXRlIGRhdGEgdG8gYmUgdmlzdWFsaXplZCBpbiB0aGUgY2hhcnQuXG4gKlxuICogQHBhcmFtIHtPYmplY3R8QXJyYXl9IGRhdGEgT3B0aW9uYWwgZGF0YSB5b3UnZCBsaWtlIHRvIHNldCBmb3IgdGhlIGNoYXJ0IGJlZm9yZSBpdCB3aWxsIHVwZGF0ZS4gSWYgbm90IHNwZWNpZmllZCB0aGUgdXBkYXRlIG1ldGhvZCB3aWxsIHVzZSB0aGUgZGF0YSB0aGF0IGlzIGFscmVhZHkgY29uZmlndXJlZCB3aXRoIHRoZSBjaGFydC5cbiAqIEBleGFtcGxlIHVwZGF0ZShbNzAsIDEwLCA0NV0pXG4gKiBAZXhhbXBsZSB1cGRhdGUoe3NlcmllczogW3t2YWx1ZTogNzB9LCAxMCwgNDVdfSlcbiAqXG4gKi9cblJhZGlhbFByb2dyZXNzQ2hhcnQucHJvdG90eXBlLnVwZGF0ZSA9IGZ1bmN0aW9uIChkYXRhKSB7XG4gIHZhciBzZWxmID0gdGhpcztcbiAgY29uc29sZS5sb2coXCJ1cGRhdGluZyFcIiwgZGF0YSk7XG5cbiAgLy8gcGFyc2UgbmV3IGRhdGFcbiAgaWYgKGRhdGEpIHtcbiAgICBpZiAodHlwZW9mIGRhdGEgPT09ICdudW1iZXInKSB7XG4gICAgICBkYXRhID0gW2RhdGFdO1xuICAgIH1cblxuICAgIHZhciBzZXJpZXM7XG5cbiAgICBpZiAoQXJyYXkuaXNBcnJheShkYXRhKSkge1xuICAgICAgc2VyaWVzID0gZGF0YTtcbiAgICB9IGVsc2UgaWYgKHR5cGVvZiBkYXRhID09PSAnb2JqZWN0Jykge1xuICAgICAgc2VyaWVzID0gZGF0YS5zZXJpZXMgfHwgW107XG4gICAgfVxuXG4gICAgZm9yICh2YXIgaSA9IDA7IGkgPCBzZXJpZXMubGVuZ3RoOyBpKyspIHtcbiAgICAgIHRoaXMub3B0aW9ucy5zZXJpZXNbaV0ucHJldmlvdXNWYWx1ZSA9IHRoaXMub3B0aW9ucy5zZXJpZXNbaV0udmFsdWU7XG5cbiAgICAgIHZhciBpdGVtID0gc2VyaWVzW2ldO1xuICAgICAgaWYgKHR5cGVvZiBpdGVtID09PSAnbnVtYmVyJykge1xuICAgICAgICB0aGlzLm9wdGlvbnMuc2VyaWVzW2ldLnZhbHVlID0gaXRlbTtcbiAgICAgIH0gZWxzZSBpZiAodHlwZW9mIGl0ZW0gPT09ICdvYmplY3QnKSB7XG4gICAgICAgIHRoaXMub3B0aW9ucy5zZXJpZXNbaV0udmFsdWUgPSBpdGVtLnZhbHVlO1xuICAgICAgICAvLyB1cGRhdGUgaXRlbS5sYWJlbFN0YXJ0IHZhbHVlXG4gICAgICAgIGlmKGl0ZW0ubGFiZWxTdGFydCkge1xuICAgICAgICAgIHRoaXMub3B0aW9ucy5zZXJpZXNbaV0ubGFiZWxTdGFydCA9IGl0ZW0ubGFiZWxTdGFydDsgXG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICAvLyBjYWxjdWxhdGUgZnJvbSBwZXJjZW50YWdlIGFuZCBuZXcgcGVyY2VudGFnZSBmb3IgdGhlIHByb2dyZXNzIGFuaW1hdGlvblxuICBzZWxmLm9wdGlvbnMuc2VyaWVzLmZvckVhY2goZnVuY3Rpb24gKGl0ZW0pIHtcbiAgICBpdGVtLmZyb21QZXJjZW50YWdlID0gaXRlbS5wZXJjZW50YWdlID8gaXRlbS5wZXJjZW50YWdlIDogNTtcbiAgICBpdGVtLnBlcmNlbnRhZ2UgPSAoaXRlbS52YWx1ZSAtIHNlbGYub3B0aW9ucy5taW4pICogMTAwIC8gKHNlbGYub3B0aW9ucy5tYXggLSBzZWxmLm9wdGlvbnMubWluKTtcbiAgfSk7XG5cbiAgdmFyIGNlbnRlciA9IHNlbGYuc3ZnLnNlbGVjdChcInRleHQucmJjLWNlbnRlci10ZXh0XCIpO1xuXG4gIC8vIHVwZGF0ZSBsYWJlbFN0YXJ0IG9uIHVwZGF0ZVxuICBzZWxmLmZpZWxkLnNlbGVjdChcInRleHQucmJjLWxhYmVsLXN0YXJ0XCIpXG4gICAgICAudGV4dChmdW5jdGlvbiAoaXRlbSkge1xuICAgICAgcmV0dXJuIGl0ZW0ubGFiZWxTdGFydDtcbiAgICB9KTtcblxuICAvLyBwcm9ncmVzc1xuICBzZWxmLmZpZWxkLnNlbGVjdChcInBhdGgucHJvZ3Jlc3NcIilcbiAgICAuaW50ZXJydXB0KClcbiAgICAudHJhbnNpdGlvbigpXG4gICAgLmR1cmF0aW9uKHNlbGYub3B0aW9ucy5hbmltYXRpb24uZHVyYXRpb24pXG4gICAgLmRlbGF5KGZ1bmN0aW9uIChkLCBpKSB7XG4gICAgICAvLyBkZWxheSBiZXR3ZWVuIGVhY2ggaXRlbVxuICAgICAgcmV0dXJuIGkgKiBzZWxmLm9wdGlvbnMuYW5pbWF0aW9uLmRlbGF5O1xuICAgIH0pXG4gICAgLmVhc2UoXCJlbGFzdGljXCIpXG4gICAgLmF0dHJUd2VlbihcImRcIiwgZnVuY3Rpb24gKGl0ZW0pIHtcbiAgICAgIHZhciBpbnRlcnBvbGF0b3IgPSBkMy5pbnRlcnBvbGF0ZU51bWJlcihpdGVtLmZyb21QZXJjZW50YWdlLCBpdGVtLnBlcmNlbnRhZ2UpO1xuICAgICAgcmV0dXJuIGZ1bmN0aW9uICh0KSB7XG4gICAgICAgIGl0ZW0ucGVyY2VudGFnZSA9IGludGVycG9sYXRvcih0KTtcbiAgICAgICAgcmV0dXJuIHNlbGYucHJvZ3Jlc3MoaXRlbSk7XG4gICAgICB9O1xuICAgIH0pXG4gICAgLnR3ZWVuKFwiY2VudGVyXCIsIGZ1bmN0aW9uIChpdGVtKSB7XG4gICAgICAvLyBFeGVjdXRlIGNhbGxiYWNrcyBvbiBlYWNoIGxpbmVcbiAgICAgIGlmIChzZWxmLm9wdGlvbnMuY2VudGVyKSB7XG4gICAgICAgIHZhciBpbnRlcnBvbGF0ZSA9IHNlbGYub3B0aW9ucy5yb3VuZCA/IGQzLmludGVycG9sYXRlUm91bmQgOiBkMy5pbnRlcnBvbGF0ZU51bWJlcjtcbiAgICAgICAgdmFyIGludGVycG9sYXRvciA9IGludGVycG9sYXRlKGl0ZW0ucHJldmlvdXNWYWx1ZSB8fCAwLCBpdGVtLnZhbHVlKTtcbiAgICAgICAgcmV0dXJuIGZ1bmN0aW9uICh0KSB7XG4gICAgICAgICAgY2VudGVyXG4gICAgICAgICAgICAuc2VsZWN0QWxsKCd0c3BhbicpXG4gICAgICAgICAgICAuZWFjaChmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICAgIGlmICh0aGlzLmNhbGxiYWNrKSB7XG4gICAgICAgICAgICAgICAgZDMuc2VsZWN0KHRoaXMpLnRleHQodGhpcy5jYWxsYmFjayhpbnRlcnBvbGF0b3IodCksIGl0ZW0uaW5kZXgsIGl0ZW0pKTtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSk7XG4gICAgICAgIH07XG4gICAgICB9XG4gICAgfSlcbiAgICAudHdlZW4oXCJpbnRlcnBvbGF0ZS1jb2xvclwiLCBmdW5jdGlvbiAoaXRlbSkge1xuICAgICAgaWYgKGl0ZW0uY29sb3IuaW50ZXJwb2xhdGUgJiYgaXRlbS5jb2xvci5pbnRlcnBvbGF0ZS5sZW5ndGggPT0gMikge1xuICAgICAgICB2YXIgY29sb3JJbnRlcnBvbGF0b3IgPSBkMy5pbnRlcnBvbGF0ZUhzbChpdGVtLmNvbG9yLmludGVycG9sYXRlWzBdLCBpdGVtLmNvbG9yLmludGVycG9sYXRlWzFdKTtcblxuICAgICAgICByZXR1cm4gZnVuY3Rpb24gKHQpIHtcbiAgICAgICAgICB2YXIgY29sb3IgPSBjb2xvckludGVycG9sYXRvcihpdGVtLnBlcmNlbnRhZ2UgLyAxMDApO1xuICAgICAgICAgIGQzLnNlbGVjdCh0aGlzKS5zdHlsZSgnZmlsbCcsIGNvbG9yKTtcbiAgICAgICAgICBkMy5zZWxlY3QodGhpcy5wYXJlbnROb2RlKS5zZWxlY3QoJ3BhdGguYmcnKS5zdHlsZSgnZmlsbCcsIGNvbG9yKTtcbiAgICAgICAgfTtcbiAgICAgIH1cbiAgICB9KVxuICAgIC5zdHlsZShcImZpbGxcIiwgZnVuY3Rpb24gKGl0ZW0pIHtcbiAgICAgIGlmIChpdGVtLmNvbG9yLnNvbGlkKSB7XG4gICAgICAgIHJldHVybiBpdGVtLmNvbG9yLnNvbGlkO1xuICAgICAgfVxuXG4gICAgICBpZiAoaXRlbS5jb2xvci5saW5lYXJHcmFkaWVudCB8fCBpdGVtLmNvbG9yLnJhZGlhbEdyYWRpZW50KSB7XG4gICAgICAgIHJldHVybiBcInVybCgjZ3JhZGllbnRcIiArIGl0ZW0uaW5kZXggKyAnKSc7XG4gICAgICB9XG4gICAgfSk7XG59O1xuXG4vKipcbiAqIFJlbW92ZSBzdmcgYW5kIGNsZWFuIHNvbWUgcmVmZXJlbmNlc1xuICovXG5SYWRpYWxQcm9ncmVzc0NoYXJ0LnByb3RvdHlwZS5kZXN0cm95ID0gZnVuY3Rpb24gKCkge1xuICB0aGlzLnN2Zy5yZW1vdmUoKTtcbiAgZGVsZXRlIHRoaXMuc3ZnO1xufTtcblxuLyoqXG4gKiBEZXRhY2ggYW5kIG5vcm1hbGl6ZSB1c2VyJ3Mgb3B0aW9ucyBpbnB1dC5cbiAqL1xuUmFkaWFsUHJvZ3Jlc3NDaGFydC5ub3JtYWxpemVPcHRpb25zID0gZnVuY3Rpb24gKG9wdGlvbnMpIHtcbiAgaWYgKCFvcHRpb25zIHx8IHR5cGVvZiBvcHRpb25zICE9PSAnb2JqZWN0Jykge1xuICAgIG9wdGlvbnMgPSB7fTtcbiAgfVxuXG4gIHZhciBfb3B0aW9ucyA9IHtcbiAgICBkaWFtZXRlcjogb3B0aW9ucy5kaWFtZXRlciB8fCAxMDAsXG4gICAgc3Ryb2tlOiB7XG4gICAgICB3aWR0aDogb3B0aW9ucy5zdHJva2UgJiYgb3B0aW9ucy5zdHJva2Uud2lkdGggfHwgNDAsXG4gICAgICBnYXA6IG9wdGlvbnMuc3Ryb2tlICYmIG9wdGlvbnMuc3Ryb2tlLmdhcCB8fCAyXG4gICAgfSxcbiAgICBzaGFkb3c6IHtcbiAgICAgIHdpZHRoOiAoIW9wdGlvbnMuc2hhZG93IHx8IG9wdGlvbnMuc2hhZG93LndpZHRoID09PSBudWxsKSA/IDQgOiBvcHRpb25zLnNoYWRvdy53aWR0aFxuICAgIH0sXG4gICAgYW5pbWF0aW9uOiB7XG4gICAgICBkdXJhdGlvbjogb3B0aW9ucy5hbmltYXRpb24gJiYgb3B0aW9ucy5hbmltYXRpb24uZHVyYXRpb24gfHwgMTc1MCxcbiAgICAgIGRlbGF5OiBvcHRpb25zLmFuaW1hdGlvbiAmJiBvcHRpb25zLmFuaW1hdGlvbi5kZWxheSB8fCAyMDBcbiAgICB9LFxuICAgIG1pbjogb3B0aW9ucy5taW4gfHwgMCxcbiAgICBtYXg6IG9wdGlvbnMubWF4IHx8IDEwMCxcbiAgICByb3VuZDogb3B0aW9ucy5yb3VuZCAhPT0gdW5kZWZpbmVkID8gISFvcHRpb25zLnJvdW5kIDogdHJ1ZSxcbiAgICBzZXJpZXM6IG9wdGlvbnMuc2VyaWVzIHx8IFtdLFxuICAgIGNlbnRlcjogUmFkaWFsUHJvZ3Jlc3NDaGFydC5ub3JtYWxpemVDZW50ZXIob3B0aW9ucy5jZW50ZXIpLFxuICB9O1xuXG4gIHZhciBkZWZhdWx0Q29sb3JzSXRlcmF0b3IgPSBuZXcgUmFkaWFsUHJvZ3Jlc3NDaGFydC5Db2xvcnNJdGVyYXRvcigpO1xuICBmb3IgKHZhciBpID0gMCwgbGVuZ3RoID0gX29wdGlvbnMuc2VyaWVzLmxlbmd0aDsgaSA8IGxlbmd0aDsgaSsrKSB7XG4gICAgdmFyIGl0ZW0gPSBvcHRpb25zLnNlcmllc1tpXTtcblxuICAgIC8vIGNvbnZlcnQgbnVtYmVyIHRvIG9iamVjdFxuICAgIGlmICh0eXBlb2YgaXRlbSA9PT0gJ251bWJlcicpIHtcbiAgICAgIGl0ZW0gPSB7dmFsdWU6IGl0ZW19O1xuICAgIH1cblxuICAgIF9vcHRpb25zLnNlcmllc1tpXSA9IHtcbiAgICAgIGluZGV4OiBpLFxuICAgICAgdmFsdWU6IGl0ZW0udmFsdWUsXG4gICAgICBsYWJlbFN0YXJ0OiBpdGVtLmxhYmVsU3RhcnQsXG4gICAgICBmaWxsOiBpdGVtLmZpbGwgfHzCoCcjMDAwMDAnLFxuICAgICAgY29sb3I6IFJhZGlhbFByb2dyZXNzQ2hhcnQubm9ybWFsaXplQ29sb3IoaXRlbS5jb2xvciwgZGVmYXVsdENvbG9yc0l0ZXJhdG9yKVxuICAgIH07XG4gIH1cblxuICByZXR1cm4gX29wdGlvbnM7XG59O1xuXG4vKipcbiAqIE5vcm1hbGl6ZSBkaWZmZXJlbnQgbm90YXRpb25zIG9mIGNvbG9yIHByb3BlcnR5XG4gKlxuICogQHBhcmFtIHtTdHJpbmd8QXJyYXl8T2JqZWN0fSBjb2xvclxuICogQGV4YW1wbGUgJyNmZTA4YjUnXG4gKiBAZXhhbXBsZSB7IHNvbGlkOiAnI2ZlMDhiNScsIGJhY2tncm91bmQ6ICcjMDAwMDAwJyB9XG4gKiBAZXhhbXBsZSBbJyMwMDAwMDAnLCAnI2ZmMDAwMCddXG4gKiBAZXhhbXBsZSB7XG4gICAgICAgICAgICAgICAgbGluZWFyR3JhZGllbnQ6IHsgeDE6ICcwJScsIHkxOiAnMTAwJScsIHgyOiAnNTAlJywgeTI6ICcwJSd9LFxuICAgICAgICAgICAgICAgIHN0b3BzOiBbXG4gICAgICAgICAgICAgICAgICB7b2Zmc2V0OiAnMCUnLCAnc3RvcC1jb2xvcic6ICcjZmUwOGI1JywgJ3N0b3Atb3BhY2l0eSc6IDF9LFxuICAgICAgICAgICAgICAgICAge29mZnNldDogJzEwMCUnLCAnc3RvcC1jb2xvcic6ICcjZmYxNDEwJywgJ3N0b3Atb3BhY2l0eSc6IDF9XG4gICAgICAgICAgICAgICAgXVxuICAgICAgICAgICAgICB9XG4gKiBAZXhhbXBsZSB7XG4gICAgICAgICAgICAgICAgcmFkaWFsR3JhZGllbnQ6IHtjeDogJzYwJywgY3k6ICc2MCcsIHI6ICc1MCd9LFxuICAgICAgICAgICAgICAgIHN0b3BzOiBbXG4gICAgICAgICAgICAgICAgICB7b2Zmc2V0OiAnMCUnLCAnc3RvcC1jb2xvcic6ICcjZmUwOGI1JywgJ3N0b3Atb3BhY2l0eSc6IDF9LFxuICAgICAgICAgICAgICAgICAge29mZnNldDogJzEwMCUnLCAnc3RvcC1jb2xvcic6ICcjZmYxNDEwJywgJ3N0b3Atb3BhY2l0eSc6IDF9XG4gICAgICAgICAgICAgICAgXVxuICAgICAgICAgICAgICB9XG4gKlxuICovXG5SYWRpYWxQcm9ncmVzc0NoYXJ0Lm5vcm1hbGl6ZUNvbG9yID0gZnVuY3Rpb24gKGNvbG9yLCBkZWZhdWx0Q29sb3JzSXRlcmF0b3IpIHtcblxuICBpZiAoIWNvbG9yKSB7XG4gICAgY29sb3IgPSB7c29saWQ6IGRlZmF1bHRDb2xvcnNJdGVyYXRvci5uZXh0KCl9O1xuICB9IGVsc2UgaWYgKHR5cGVvZiBjb2xvciA9PT0gJ3N0cmluZycpIHtcbiAgICBjb2xvciA9IHtzb2xpZDogY29sb3J9O1xuICB9IGVsc2UgaWYgKEFycmF5LmlzQXJyYXkoY29sb3IpKSB7XG4gICAgY29sb3IgPSB7aW50ZXJwb2xhdGU6IGNvbG9yfTtcbiAgfSBlbHNlIGlmICh0eXBlb2YgY29sb3IgPT09ICdvYmplY3QnKSB7XG4gICAgaWYgKCFjb2xvci5zb2xpZCAmJiAhY29sb3IuaW50ZXJwb2xhdGUgJiYgIWNvbG9yLmxpbmVhckdyYWRpZW50ICYmICFjb2xvci5yYWRpYWxHcmFkaWVudCkge1xuICAgICAgY29sb3Iuc29saWQgPSBkZWZhdWx0Q29sb3JzSXRlcmF0b3IubmV4dCgpO1xuICAgIH1cbiAgfVxuXG4gIC8vIFZhbGlkYXRlIGludGVycG9sYXRlIHN5bnRheFxuICBpZiAoY29sb3IuaW50ZXJwb2xhdGUpIHtcbiAgICBpZiAoY29sb3IuaW50ZXJwb2xhdGUubGVuZ3RoICE9PSAyKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoJ2ludGVycG9sYXRlIGFycmF5IHNob3VsZCBjb250YWluIHR3byBjb2xvcnMnKTtcbiAgICB9XG4gIH1cblxuICAvLyBWYWxpZGF0ZSBncmFkaWVudCBzeW50YXhcbiAgaWYgKGNvbG9yLmxpbmVhckdyYWRpZW50IHx8IGNvbG9yLnJhZGlhbEdyYWRpZW50KSB7XG4gICAgaWYgKCFjb2xvci5zdG9wcyB8fCAhQXJyYXkuaXNBcnJheShjb2xvci5zdG9wcykgfHwgY29sb3Iuc3RvcHMubGVuZ3RoICE9PSAyKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoJ2dyYWRpZW50IHN5bnRheCBpcyBtYWxmb3JtZWQnKTtcbiAgICB9XG4gIH1cblxuICAvLyBTZXQgYmFja2dyb3VuZCB3aGVuIGlzIG5vdCBwcm92aWRlZFxuICBpZiAoIWNvbG9yLmJhY2tncm91bmQpIHtcbiAgICBpZiAoY29sb3Iuc29saWQpIHtcbiAgICAgIGNvbG9yLmJhY2tncm91bmQgPSBjb2xvci5zb2xpZDtcbiAgICB9IGVsc2UgaWYgKGNvbG9yLmludGVycG9sYXRlKSB7XG4gICAgICBjb2xvci5iYWNrZ3JvdW5kID0gY29sb3IuaW50ZXJwb2xhdGVbMF07XG4gICAgfSBlbHNlIGlmIChjb2xvci5saW5lYXJHcmFkaWVudCB8fCBjb2xvci5yYWRpYWxHcmFkaWVudCkge1xuICAgICAgY29sb3IuYmFja2dyb3VuZCA9IGNvbG9yLnN0b3BzWzBdWydzdG9wLWNvbG9yJ107XG4gICAgfVxuICB9XG5cbiAgcmV0dXJuIGNvbG9yO1xuXG59O1xuXG5cbi8qKlxuICogTm9ybWFsaXplIGRpZmZlcmVudCBub3RhdGlvbnMgb2YgY2VudGVyIHByb3BlcnR5XG4gKlxuICogQHBhcmFtIHtTdHJpbmd8QXJyYXl8RnVuY3Rpb258T2JqZWN0fSBjZW50ZXJcbiAqIEBleGFtcGxlICdmb28gYmFyJ1xuICogQGV4YW1wbGUgeyBjb250ZW50OiAnZm9vIGJhcicsIHg6IDEwLCB5OiA0IH1cbiAqIEBleGFtcGxlIGZ1bmN0aW9uKHZhbHVlLCBpbmRleCwgaXRlbSkge31cbiAqIEBleGFtcGxlIFsnZm9vIGJhcicsIGZ1bmN0aW9uKHZhbHVlLCBpbmRleCwgaXRlbSkge31dXG4gKi9cblJhZGlhbFByb2dyZXNzQ2hhcnQubm9ybWFsaXplQ2VudGVyID0gZnVuY3Rpb24gKGNlbnRlcikge1xuICBpZiAoIWNlbnRlcikgcmV0dXJuIG51bGw7XG5cbiAgLy8gQ29udmVydCB0byBvYmplY3Qgbm90YXRpb25cbiAgaWYgKGNlbnRlci5jb25zdHJ1Y3RvciAhPT0gT2JqZWN0KSB7XG4gICAgY2VudGVyID0ge2NvbnRlbnQ6IGNlbnRlcn07XG4gIH1cblxuICAvLyBEZWZhdWx0c1xuICBjZW50ZXIuY29udGVudCA9IGNlbnRlci5jb250ZW50IHx8IFtdO1xuICBjZW50ZXIueCA9IGNlbnRlci54IHx8IDA7XG4gIGNlbnRlci55ID0gY2VudGVyLnkgfHwgMDtcblxuICAvLyBDb252ZXJ0IGNvbnRlbnQgdG8gYXJyYXkgbm90YXRpb25cbiAgaWYgKCFBcnJheS5pc0FycmF5KGNlbnRlci5jb250ZW50KSkge1xuICAgIGNlbnRlci5jb250ZW50ID0gW2NlbnRlci5jb250ZW50XTtcbiAgfVxuXG4gIHJldHVybiBjZW50ZXI7XG59O1xuXG4vLyBMaW5lYXIgb3IgUmFkaWFsIEdyYWRpZW50IGludGVybmFsIG9iamVjdFxuUmFkaWFsUHJvZ3Jlc3NDaGFydC5HcmFkaWVudCA9IChmdW5jdGlvbiAoKSB7XG4gIGZ1bmN0aW9uIEdyYWRpZW50KCkge1xuICB9XG5cbiAgR3JhZGllbnQudG9TVkdFbGVtZW50ID0gZnVuY3Rpb24gKGlkLCBvcHRpb25zKSB7XG4gICAgdmFyIGdyYWRpZW50VHlwZSA9IG9wdGlvbnMubGluZWFyR3JhZGllbnQgPyAnbGluZWFyR3JhZGllbnQnIDogJ3JhZGlhbEdyYWRpZW50JztcbiAgICB2YXIgZ3JhZGllbnQgPSBkMy5zZWxlY3QoZG9jdW1lbnQuY3JlYXRlRWxlbWVudE5TKGQzLm5zLnByZWZpeC5zdmcsIGdyYWRpZW50VHlwZSkpXG4gICAgICAuYXR0cihvcHRpb25zW2dyYWRpZW50VHlwZV0pXG4gICAgICAuYXR0cignaWQnLCBpZCk7XG5cbiAgICBvcHRpb25zLnN0b3BzLmZvckVhY2goZnVuY3Rpb24gKHN0b3BBdHRycykge1xuICAgICAgZ3JhZGllbnQuYXBwZW5kKFwic3ZnOnN0b3BcIikuYXR0cihzdG9wQXR0cnMpO1xuICAgIH0pO1xuXG4gICAgdGhpcy5iYWNrZ3JvdW5kID0gb3B0aW9ucy5zdG9wc1swXVsnc3RvcC1jb2xvciddO1xuXG4gICAgcmV0dXJuIGdyYWRpZW50Lm5vZGUoKTtcbiAgfTtcblxuICByZXR1cm4gR3JhZGllbnQ7XG59KSgpO1xuXG4vLyBEZWZhdWx0IGNvbG9ycyBpdGVyYXRvclxuUmFkaWFsUHJvZ3Jlc3NDaGFydC5Db2xvcnNJdGVyYXRvciA9IChmdW5jdGlvbiAoKSB7XG5cbiAgQ29sb3JzSXRlcmF0b3IuREVGQVVMVF9DT0xPUlMgPSBbXCIjMWFkNWRlXCIsIFwiI2EwZmYwM1wiLCBcIiNlOTBiM2FcIiwgJyNmZjk1MDAnLCAnIzAwN2FmZicsICcjZmZjYzAwJywgJyM1ODU2ZDYnLCAnIzhlOGU5MyddO1xuXG4gIGZ1bmN0aW9uIENvbG9yc0l0ZXJhdG9yKCkge1xuICAgIHRoaXMuaW5kZXggPSAwO1xuICB9XG5cbiAgQ29sb3JzSXRlcmF0b3IucHJvdG90eXBlLm5leHQgPSBmdW5jdGlvbiAoKSB7XG4gICAgaWYgKHRoaXMuaW5kZXggPT09IENvbG9yc0l0ZXJhdG9yLkRFRkFVTFRfQ09MT1JTLmxlbmd0aCkge1xuICAgICAgdGhpcy5pbmRleCA9IDA7XG4gICAgfVxuXG4gICAgcmV0dXJuIENvbG9yc0l0ZXJhdG9yLkRFRkFVTFRfQ09MT1JTW3RoaXMuaW5kZXgrK107XG4gIH07XG5cbiAgcmV0dXJuIENvbG9yc0l0ZXJhdG9yO1xufSkoKTtcblxuXG4vLyBFeHBvcnQgUmFkaWFsUHJvZ3Jlc3NDaGFydCBvYmplY3RcbmlmICh0eXBlb2YgbW9kdWxlICE9PSBcInVuZGVmaW5lZFwiKW1vZHVsZS5leHBvcnRzID0gUmFkaWFsUHJvZ3Jlc3NDaGFydDsiXX0=
