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

  // add linear gradient to stroke
  defs = self.svg.append("svg:defs"); 
  var gradientId = "gradient-" + Math.random(); 
  var gradient = defs.append("linearGradient").attr("id", gradientId); 

  series.forEach(function (item) {
    if(item.linearGradient) {
      for(var i=0; i<item.linearGradient.stops.length; i++) {
        var stop = item.linearGradient.stops[i];
        gradient.append("stop")
          .attr("offset", stop.offset)
          .attr("stop-color", stop['stop-color'])
          .attr("stop-opacity", stop['stop-opacity']);
      }

    }
  });


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

  self.field.append("path").attr("class", "progress")
    .attr("filter", "url(#" + dropshadowId +")")
    .attr("stroke", function(item) {
      if(item.linearGradient) {
        return "url(#" + gradientId + ")";
      }
    });
    // .style("stroke-width", 5)
    // .style("stroke", "white");

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
      if(item.linearGradient) {
        return "none";
      }
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
      linearGradient: item.linearGradient || null,
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
//# sourceMappingURL=data:application/json;charset:utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJpbmRleC5qcyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTtBQ0FBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSIsImZpbGUiOiJnZW5lcmF0ZWQuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlc0NvbnRlbnQiOlsiKGZ1bmN0aW9uIGUodCxuLHIpe2Z1bmN0aW9uIHMobyx1KXtpZighbltvXSl7aWYoIXRbb10pe3ZhciBhPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7aWYoIXUmJmEpcmV0dXJuIGEobywhMCk7aWYoaSlyZXR1cm4gaShvLCEwKTt2YXIgZj1uZXcgRXJyb3IoXCJDYW5ub3QgZmluZCBtb2R1bGUgJ1wiK28rXCInXCIpO3Rocm93IGYuY29kZT1cIk1PRFVMRV9OT1RfRk9VTkRcIixmfXZhciBsPW5bb109e2V4cG9ydHM6e319O3Rbb11bMF0uY2FsbChsLmV4cG9ydHMsZnVuY3Rpb24oZSl7dmFyIG49dFtvXVsxXVtlXTtyZXR1cm4gcyhuP246ZSl9LGwsbC5leHBvcnRzLGUsdCxuLHIpfXJldHVybiBuW29dLmV4cG9ydHN9dmFyIGk9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtmb3IodmFyIG89MDtvPHIubGVuZ3RoO28rKylzKHJbb10pO3JldHVybiBzfSkiLCIndXNlIHN0cmljdCc7XG5cbnZhciBkMztcblxuLy8gUmFkaWFsUHJvZ3Jlc3NDaGFydCBvYmplY3RcbmZ1bmN0aW9uIFJhZGlhbFByb2dyZXNzQ2hhcnQocXVlcnksIG9wdGlvbnMpIHtcblxuICAvLyB2ZXJpZnkgZDMgaXMgbG9hZGVkXG4gIGQzID0gKHR5cGVvZiB3aW5kb3cgIT09ICd1bmRlZmluZWQnICYmIHdpbmRvdy5kMykgPyB3aW5kb3cuZDMgOiB0eXBlb2YgcmVxdWlyZSAhPT0gJ3VuZGVmaW5lZCcgPyByZXF1aXJlKFwiZDNcIikgOiB1bmRlZmluZWQ7XG4gIGlmKCFkMykgdGhyb3cgbmV3IEVycm9yKCdkMyBvYmplY3QgaXMgbWlzc2luZy4gRDMuanMgbGlicmFyeSBoYXMgdG8gYmUgbG9hZGVkIGJlZm9yZS4nKTtcblxuICB2YXIgc2VsZiA9IHRoaXM7XG4gIHNlbGYub3B0aW9ucyA9IFJhZGlhbFByb2dyZXNzQ2hhcnQubm9ybWFsaXplT3B0aW9ucyhvcHRpb25zKTtcblxuICAvLyBpbnRlcm5hbCAgdmFyaWFibGVzXG4gIHZhciBzZXJpZXMgPSBzZWxmLm9wdGlvbnMuc2VyaWVzXG4gICAgLCB3aWR0aCA9IDE1ICsgKChzZWxmLm9wdGlvbnMuZGlhbWV0ZXIgLyAyKSArIChzZWxmLm9wdGlvbnMuc3Ryb2tlLndpZHRoICogc2VsZi5vcHRpb25zLnNlcmllcy5sZW5ndGgpICsgKHNlbGYub3B0aW9ucy5zdHJva2UuZ2FwICogc2VsZi5vcHRpb25zLnNlcmllcy5sZW5ndGggLSAxKSkgKiAyXG4gICAgLCBoZWlnaHQgPSB3aWR0aFxuICAgICwgZGltID0gXCIwIDAgXCIgKyBoZWlnaHQgKyBcIiBcIiArIHdpZHRoXG4gICAgLCDPhCA9IDIgKiBNYXRoLlBJXG4gICAgLCBpbm5lciA9IFtdXG4gICAgLCBvdXRlciA9IFtdO1xuXG4gIGZ1bmN0aW9uIGlubmVyUmFkaXVzKGl0ZW0pIHtcbiAgICB2YXIgcmFkaXVzID0gaW5uZXJbaXRlbS5pbmRleF07XG4gICAgaWYgKHJhZGl1cykgcmV0dXJuIHJhZGl1cztcblxuICAgIC8vIGZpcnN0IHJpbmcgYmFzZWQgb24gZGlhbWV0ZXIgYW5kIHRoZSByZXN0IGJhc2VkIG9uIHRoZSBwcmV2aW91cyBvdXRlciByYWRpdXMgcGx1cyBnYXBcbiAgICByYWRpdXMgPSBpdGVtLmluZGV4ID09PSAwID8gc2VsZi5vcHRpb25zLmRpYW1ldGVyIC8gMiA6IG91dGVyW2l0ZW0uaW5kZXggLSAxXSArIHNlbGYub3B0aW9ucy5zdHJva2UuZ2FwO1xuICAgIGlubmVyW2l0ZW0uaW5kZXhdID0gcmFkaXVzO1xuICAgIHJldHVybiByYWRpdXM7XG4gIH1cblxuICBmdW5jdGlvbiBvdXRlclJhZGl1cyhpdGVtKSB7XG4gICAgdmFyIHJhZGl1cyA9IG91dGVyW2l0ZW0uaW5kZXhdO1xuICAgIGlmIChyYWRpdXMpIHJldHVybiByYWRpdXM7XG5cbiAgICAvLyBiYXNlZCBvbiB0aGUgcHJldmlvdXMgaW5uZXIgcmFkaXVzICsgc3Ryb2tlIHdpZHRoXG4gICAgcmFkaXVzID0gaW5uZXJbaXRlbS5pbmRleF0gKyBzZWxmLm9wdGlvbnMuc3Ryb2tlLndpZHRoO1xuICAgIG91dGVyW2l0ZW0uaW5kZXhdID0gcmFkaXVzO1xuICAgIHJldHVybiByYWRpdXM7XG4gIH1cblxuICBzZWxmLnByb2dyZXNzID0gZDMuc3ZnLmFyYygpXG4gICAgLy8gLnN0YXJ0QW5nbGUoMClcbiAgICAvLyAuZW5kQW5nbGUoZnVuY3Rpb24gKGl0ZW0pIHtcbiAgICAvLyAgIHJldHVybiBpdGVtLnBlcmNlbnRhZ2UgLyAxMDAgKiDPhDtcbiAgICAvLyB9KVxuXG4gICAgLnN0YXJ0QW5nbGUoZnVuY3Rpb24oaXRlbSkge1xuICAgICAgaWYoaXRlbS5yZXZlcnNlKSB7XG4gICAgICAgIHJldHVybiDPhDtcbiAgICAgIH1cbiAgICAgIHJldHVybiAwO1xuICAgIH0pXG4gICAgLmVuZEFuZ2xlKGZ1bmN0aW9uIChpdGVtKSB7XG4gICAgICBpZihpdGVtLnJldmVyc2UpIHtcbiAgICAgICAgcmV0dXJuIM+EIC0gKGl0ZW0ucGVyY2VudGFnZSAvIDEwMCAqIM+EKTtcbiAgICAgIH1cbiAgICAgIHJldHVybiBpdGVtLnBlcmNlbnRhZ2UgLyAxMDAgKiDPhDtcbiAgICB9KVxuICAgIC5pbm5lclJhZGl1cyhpbm5lclJhZGl1cylcbiAgICAub3V0ZXJSYWRpdXMob3V0ZXJSYWRpdXMpXG4gICAgLmNvcm5lclJhZGl1cyhmdW5jdGlvbiAoZCkge1xuICAgICAgLy8gV29ya2Fyb3VuZCBmb3IgZDMgYnVnIGh0dHBzOi8vZ2l0aHViLmNvbS9tYm9zdG9jay9kMy9pc3N1ZXMvMjI0OVxuICAgICAgLy8gUmVkdWNlIGNvcm5lciByYWRpdXMgd2hlbiBjb3JuZXJzIGFyZSBjbG9zZSBlYWNoIG90aGVyXG4gICAgICB2YXIgbSA9IGQucGVyY2VudGFnZSA+PSA5MCA/ICgxMDAgLSBkLnBlcmNlbnRhZ2UpICogMC4xIDogMTtcbiAgICAgIHJldHVybiAoc2VsZi5vcHRpb25zLnN0cm9rZS53aWR0aCAvIDIpICogbTtcbiAgICB9KTtcblxuICB2YXIgYmFja2dyb3VuZCA9IGQzLnN2Zy5hcmMoKVxuICAgIC5zdGFydEFuZ2xlKDApXG4gICAgLmVuZEFuZ2xlKM+EKVxuICAgIC5pbm5lclJhZGl1cyhpbm5lclJhZGl1cylcbiAgICAub3V0ZXJSYWRpdXMob3V0ZXJSYWRpdXMpO1xuXG4gIC8vIGNyZWF0ZSBzdmdcbiAgc2VsZi5zdmcgPSBkMy5zZWxlY3QocXVlcnkpLmFwcGVuZChcInN2Z1wiKVxuICAgIC5hdHRyKFwicHJlc2VydmVBc3BlY3RSYXRpb1wiLFwieE1pbllNaW4gbWVldFwiKVxuICAgIC5hdHRyKFwidmlld0JveFwiLCBkaW0pXG4gICAgLmFwcGVuZChcImdcIilcbiAgICAuYXR0cihcInRyYW5zZm9ybVwiLCBcInRyYW5zbGF0ZShcIiArIHdpZHRoIC8gMiArIFwiLFwiICsgaGVpZ2h0IC8gMiArIFwiKVwiKTtcblxuICAvLyBhZGQgZ3JhZGllbnRzIGRlZnNcbiAgdmFyIGRlZnMgPSBzZWxmLnN2Zy5hcHBlbmQoXCJzdmc6ZGVmc1wiKTtcbiAgc2VyaWVzLmZvckVhY2goZnVuY3Rpb24gKGl0ZW0pIHtcbiAgICBpZiAoaXRlbS5jb2xvci5saW5lYXJHcmFkaWVudCB8fCBpdGVtLmNvbG9yLnJhZGlhbEdyYWRpZW50KSB7XG4gICAgICB2YXIgZ3JhZGllbnQgPSBSYWRpYWxQcm9ncmVzc0NoYXJ0LkdyYWRpZW50LnRvU1ZHRWxlbWVudCgnZ3JhZGllbnQnICsgaXRlbS5pbmRleCwgaXRlbS5jb2xvcik7XG4gICAgICBkZWZzLm5vZGUoKS5hcHBlbmRDaGlsZChncmFkaWVudCk7XG4gICAgfVxuICB9KTtcblxuICAvLyBhZGQgc2hhZG93cyBkZWZzXG4gIGRlZnMgPSBzZWxmLnN2Zy5hcHBlbmQoXCJzdmc6ZGVmc1wiKTtcbiAgdmFyIGRyb3BzaGFkb3dJZCA9IFwiZHJvcHNoYWRvdy1cIiArIE1hdGgucmFuZG9tKCk7XG4gIHZhciBmaWx0ZXIgPSBkZWZzLmFwcGVuZChcImZpbHRlclwiKS5hdHRyKFwiaWRcIiwgZHJvcHNoYWRvd0lkKTtcbiAgaWYoc2VsZi5vcHRpb25zLnNoYWRvdy53aWR0aCA+IDApIHtcbiAgICBcbiAgICBmaWx0ZXIuYXBwZW5kKFwiZmVHYXVzc2lhbkJsdXJcIilcbiAgICAgIC5hdHRyKFwiaW5cIiwgXCJTb3VyY2VBbHBoYVwiKVxuICAgICAgLmF0dHIoXCJzdGREZXZpYXRpb25cIiwgc2VsZi5vcHRpb25zLnNoYWRvdy53aWR0aClcbiAgICAgIC5hdHRyKFwicmVzdWx0XCIsIFwiYmx1clwiKTtcblxuICAgIGZpbHRlci5hcHBlbmQoXCJmZU9mZnNldFwiKVxuICAgICAgLmF0dHIoXCJpblwiLCBcImJsdXJcIilcbiAgICAgIC5hdHRyKFwiZHhcIiwgMSlcbiAgICAgIC5hdHRyKFwiZHlcIiwgMSlcbiAgICAgIC5hdHRyKFwicmVzdWx0XCIsIFwib2Zmc2V0Qmx1clwiKTtcbiAgfVxuXG4gIHZhciBmZU1lcmdlID0gZmlsdGVyLmFwcGVuZChcImZlTWVyZ2VcIik7XG4gIGZlTWVyZ2UuYXBwZW5kKFwiZmVNZXJnZU5vZGVcIikuYXR0cihcImluXCIsIFwib2Zmc2V0Qmx1clwiKTtcbiAgZmVNZXJnZS5hcHBlbmQoXCJmZU1lcmdlTm9kZVwiKS5hdHRyKFwiaW5cIiwgXCJTb3VyY2VHcmFwaGljXCIpO1xuXG4gIC8vIGFkZCBsaW5lYXIgZ3JhZGllbnQgdG8gc3Ryb2tlXG4gIGRlZnMgPSBzZWxmLnN2Zy5hcHBlbmQoXCJzdmc6ZGVmc1wiKTsgXG4gIHZhciBncmFkaWVudElkID0gXCJncmFkaWVudC1cIiArIE1hdGgucmFuZG9tKCk7IFxuICB2YXIgZ3JhZGllbnQgPSBkZWZzLmFwcGVuZChcImxpbmVhckdyYWRpZW50XCIpLmF0dHIoXCJpZFwiLCBncmFkaWVudElkKTsgXG5cbiAgc2VyaWVzLmZvckVhY2goZnVuY3Rpb24gKGl0ZW0pIHtcbiAgICBpZihpdGVtLmxpbmVhckdyYWRpZW50KSB7XG4gICAgICBmb3IodmFyIGk9MDsgaTxpdGVtLmxpbmVhckdyYWRpZW50LnN0b3BzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgIHZhciBzdG9wID0gaXRlbS5saW5lYXJHcmFkaWVudC5zdG9wc1tpXTtcbiAgICAgICAgZ3JhZGllbnQuYXBwZW5kKFwic3RvcFwiKVxuICAgICAgICAgIC5hdHRyKFwib2Zmc2V0XCIsIHN0b3Aub2Zmc2V0KVxuICAgICAgICAgIC5hdHRyKFwic3RvcC1jb2xvclwiLCBzdG9wWydzdG9wLWNvbG9yJ10pXG4gICAgICAgICAgLmF0dHIoXCJzdG9wLW9wYWNpdHlcIiwgc3RvcFsnc3RvcC1vcGFjaXR5J10pO1xuICAgICAgfVxuXG4gICAgfVxuICB9KTtcblxuXG4gIC8vIGFkZCBpbm5lciB0ZXh0XG4gIGlmIChzZWxmLm9wdGlvbnMuY2VudGVyKSB7XG4gICAgc2VsZi5zdmcuYXBwZW5kKFwidGV4dFwiKVxuICAgICAgLmF0dHIoJ2NsYXNzJywgJ3JiYy1jZW50ZXItdGV4dCcpXG4gICAgICAuYXR0cihcInRleHQtYW5jaG9yXCIsIFwibWlkZGxlXCIpXG4gICAgICAuYXR0cigneCcsIHNlbGYub3B0aW9ucy5jZW50ZXIueCArICdweCcpXG4gICAgICAuYXR0cigneScsIHNlbGYub3B0aW9ucy5jZW50ZXIueSArICdweCcpXG4gICAgICAuc2VsZWN0QWxsKCd0c3BhbicpXG4gICAgICAuZGF0YShzZWxmLm9wdGlvbnMuY2VudGVyLmNvbnRlbnQpLmVudGVyKClcbiAgICAgIC5hcHBlbmQoJ3RzcGFuJylcbiAgICAgIC5hdHRyKFwiZG9taW5hbnQtYmFzZWxpbmVcIiwgZnVuY3Rpb24gKCkge1xuXG4gICAgICAgIC8vIFNpbmdsZSBsaW5lcyBjYW4gZWFzaWx5IGNlbnRlcmVkIGluIHRoZSBtaWRkbGUgdXNpbmcgZG9taW5hbnQtYmFzZWxpbmUsIG11bHRpbGluZSBuZWVkIHRvIHVzZSB5XG4gICAgICAgIGlmIChzZWxmLm9wdGlvbnMuY2VudGVyLmNvbnRlbnQubGVuZ3RoID09PSAxKSB7XG4gICAgICAgICAgcmV0dXJuICdjZW50cmFsJztcbiAgICAgICAgfVxuICAgICAgfSlcbiAgICAgIC5hdHRyKCdjbGFzcycsIGZ1bmN0aW9uIChkLCBpKSB7XG4gICAgICAgIHJldHVybiAncmJjLWNlbnRlci10ZXh0LWxpbmUnICsgaTtcbiAgICAgIH0pXG4gICAgICAuYXR0cigneCcsIDApXG4gICAgICAuYXR0cignZHknLCBmdW5jdGlvbiAoZCwgaSkge1xuICAgICAgICBpZiAoaSA+IDApIHtcbiAgICAgICAgICByZXR1cm4gJzEuMWVtJztcbiAgICAgICAgfVxuICAgICAgfSlcbiAgICAgIC5lYWNoKGZ1bmN0aW9uIChkKSB7XG4gICAgICAgIGlmICh0eXBlb2YgZCA9PT0gJ2Z1bmN0aW9uJykge1xuICAgICAgICAgIHRoaXMuY2FsbGJhY2sgPSBkO1xuICAgICAgICB9XG4gICAgICB9KVxuICAgICAgLnRleHQoZnVuY3Rpb24gKGQpIHtcbiAgICAgICAgaWYgKHR5cGVvZiBkID09PSAnc3RyaW5nJykge1xuICAgICAgICAgIHJldHVybiBkO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuICcnO1xuICAgICAgfSk7XG4gIH1cblxuICAvLyBhZGQgcmluZyBzdHJ1Y3R1cmVcbiAgc2VsZi5maWVsZCA9IHNlbGYuc3ZnLnNlbGVjdEFsbChcImdcIilcbiAgICAuZGF0YShzZXJpZXMpXG4gICAgLmVudGVyKCkuYXBwZW5kKFwiZ1wiKTtcblxuICBzZWxmLmZpZWxkLmFwcGVuZChcInBhdGhcIikuYXR0cihcImNsYXNzXCIsIFwicHJvZ3Jlc3NcIilcbiAgICAuYXR0cihcImZpbHRlclwiLCBcInVybCgjXCIgKyBkcm9wc2hhZG93SWQgK1wiKVwiKVxuICAgIC5hdHRyKFwic3Ryb2tlXCIsIGZ1bmN0aW9uKGl0ZW0pIHtcbiAgICAgIGlmKGl0ZW0ubGluZWFyR3JhZGllbnQpIHtcbiAgICAgICAgcmV0dXJuIFwidXJsKCNcIiArIGdyYWRpZW50SWQgKyBcIilcIjtcbiAgICAgIH1cbiAgICB9KTtcbiAgICAvLyAuc3R5bGUoXCJzdHJva2Utd2lkdGhcIiwgNSlcbiAgICAvLyAuc3R5bGUoXCJzdHJva2VcIiwgXCJ3aGl0ZVwiKTtcblxuICBzZWxmLmZpZWxkLmFwcGVuZChcInBhdGhcIikuYXR0cihcImNsYXNzXCIsIFwiYmdcIilcbiAgICAuc3R5bGUoXCJmaWxsXCIsIGZ1bmN0aW9uIChpdGVtKSB7XG4gICAgICByZXR1cm4gaXRlbS5jb2xvci5iYWNrZ3JvdW5kO1xuICAgIH0pXG4gICAgLnN0eWxlKFwib3BhY2l0eVwiLCAwLjIpXG4gICAgLmF0dHIoXCJkXCIsIGJhY2tncm91bmQpO1xuXG4gIHNlbGYuZmllbGQuYXBwZW5kKFwidGV4dFwiKVxuICAgIC5jbGFzc2VkKCdyYmMtbGFiZWwgcmJjLWxhYmVsLXN0YXJ0JywgdHJ1ZSlcbiAgICAuYXR0cihcImRvbWluYW50LWJhc2VsaW5lXCIsIFwiY2VudHJhbFwiKVxuICAgIC5hdHRyKFwieFwiLCBcIjEwXCIpXG4gICAgLmF0dHIoXCJ5XCIsIGZ1bmN0aW9uIChpdGVtKSB7XG4gICAgICByZXR1cm4gLShcbiAgICAgICAgc2VsZi5vcHRpb25zLmRpYW1ldGVyIC8gMiArXG4gICAgICAgIGl0ZW0uaW5kZXggKiAoc2VsZi5vcHRpb25zLnN0cm9rZS5nYXAgKyBzZWxmLm9wdGlvbnMuc3Ryb2tlLndpZHRoKSArXG4gICAgICAgIHNlbGYub3B0aW9ucy5zdHJva2Uud2lkdGggLyAyXG4gICAgICAgICk7XG4gICAgfSlcbiAgICAuc3R5bGUoXCJmaWxsXCIsIGZ1bmN0aW9uKGl0ZW0pIHtcbiAgICAgICAgcmV0dXJuIGl0ZW0uZmlsbDtcbiAgICB9KVxuICAgIC50ZXh0KGZ1bmN0aW9uIChpdGVtKSB7XG4gICAgICByZXR1cm4gaXRlbS5sYWJlbFN0YXJ0O1xuICAgIH0pO1xuXG4gIHNlbGYudXBkYXRlKCk7XG59XG5cbi8qKlxuICogVXBkYXRlIGRhdGEgdG8gYmUgdmlzdWFsaXplZCBpbiB0aGUgY2hhcnQuXG4gKlxuICogQHBhcmFtIHtPYmplY3R8QXJyYXl9IGRhdGEgT3B0aW9uYWwgZGF0YSB5b3UnZCBsaWtlIHRvIHNldCBmb3IgdGhlIGNoYXJ0IGJlZm9yZSBpdCB3aWxsIHVwZGF0ZS4gSWYgbm90IHNwZWNpZmllZCB0aGUgdXBkYXRlIG1ldGhvZCB3aWxsIHVzZSB0aGUgZGF0YSB0aGF0IGlzIGFscmVhZHkgY29uZmlndXJlZCB3aXRoIHRoZSBjaGFydC5cbiAqIEBleGFtcGxlIHVwZGF0ZShbNzAsIDEwLCA0NV0pXG4gKiBAZXhhbXBsZSB1cGRhdGUoe3NlcmllczogW3t2YWx1ZTogNzB9LCAxMCwgNDVdfSlcbiAqXG4gKi9cblJhZGlhbFByb2dyZXNzQ2hhcnQucHJvdG90eXBlLnVwZGF0ZSA9IGZ1bmN0aW9uIChkYXRhKSB7XG4gIHZhciBzZWxmID0gdGhpcztcblxuICAvLyBwYXJzZSBuZXcgZGF0YVxuICBpZiAoZGF0YSkge1xuICAgIGlmICh0eXBlb2YgZGF0YSA9PT0gJ251bWJlcicpIHtcbiAgICAgIGRhdGEgPSBbZGF0YV07XG4gICAgfVxuXG4gICAgdmFyIHNlcmllcztcblxuICAgIGlmIChBcnJheS5pc0FycmF5KGRhdGEpKSB7XG4gICAgICBzZXJpZXMgPSBkYXRhO1xuICAgIH0gZWxzZSBpZiAodHlwZW9mIGRhdGEgPT09ICdvYmplY3QnKSB7XG4gICAgICBzZXJpZXMgPSBkYXRhLnNlcmllcyB8fCBbXTtcbiAgICB9XG5cbiAgICBmb3IgKHZhciBpID0gMDsgaSA8IHNlcmllcy5sZW5ndGg7IGkrKykge1xuICAgICAgdGhpcy5vcHRpb25zLnNlcmllc1tpXS5wcmV2aW91c1ZhbHVlID0gdGhpcy5vcHRpb25zLnNlcmllc1tpXS52YWx1ZTtcblxuICAgICAgdmFyIGl0ZW0gPSBzZXJpZXNbaV07XG4gICAgICBpZiAodHlwZW9mIGl0ZW0gPT09ICdudW1iZXInKSB7XG4gICAgICAgIHRoaXMub3B0aW9ucy5zZXJpZXNbaV0udmFsdWUgPSBpdGVtO1xuICAgICAgfSBlbHNlIGlmICh0eXBlb2YgaXRlbSA9PT0gJ29iamVjdCcpIHtcbiAgICAgICAgdGhpcy5vcHRpb25zLnNlcmllc1tpXS52YWx1ZSA9IGl0ZW0udmFsdWU7XG4gICAgICAgIC8vIHVwZGF0ZSBpdGVtLmxhYmVsU3RhcnQgdmFsdWVcbiAgICAgICAgaWYoaXRlbS5sYWJlbFN0YXJ0KSB7XG4gICAgICAgICAgdGhpcy5vcHRpb25zLnNlcmllc1tpXS5sYWJlbFN0YXJ0ID0gaXRlbS5sYWJlbFN0YXJ0OyBcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIC8vIGNhbGN1bGF0ZSBmcm9tIHBlcmNlbnRhZ2UgYW5kIG5ldyBwZXJjZW50YWdlIGZvciB0aGUgcHJvZ3Jlc3MgYW5pbWF0aW9uXG4gIHNlbGYub3B0aW9ucy5zZXJpZXMuZm9yRWFjaChmdW5jdGlvbiAoaXRlbSkge1xuICAgIGl0ZW0uZnJvbVBlcmNlbnRhZ2UgPSBpdGVtLnBlcmNlbnRhZ2UgPyBpdGVtLnBlcmNlbnRhZ2UgOiA1O1xuICAgIGl0ZW0ucGVyY2VudGFnZSA9IChpdGVtLnZhbHVlIC0gc2VsZi5vcHRpb25zLm1pbikgKiAxMDAgLyAoc2VsZi5vcHRpb25zLm1heCAtIHNlbGYub3B0aW9ucy5taW4pO1xuICB9KTtcblxuICB2YXIgY2VudGVyID0gc2VsZi5zdmcuc2VsZWN0KFwidGV4dC5yYmMtY2VudGVyLXRleHRcIik7XG5cbiAgLy8gdXBkYXRlIGxhYmVsU3RhcnQgb24gdXBkYXRlXG4gIHNlbGYuZmllbGQuc2VsZWN0KFwidGV4dC5yYmMtbGFiZWwtc3RhcnRcIilcbiAgICAgIC50ZXh0KGZ1bmN0aW9uIChpdGVtKSB7XG4gICAgICByZXR1cm4gaXRlbS5sYWJlbFN0YXJ0O1xuICAgIH0pO1xuXG4gIC8vIHByb2dyZXNzXG4gIHNlbGYuZmllbGQuc2VsZWN0KFwicGF0aC5wcm9ncmVzc1wiKVxuICAgIC5pbnRlcnJ1cHQoKVxuICAgIC50cmFuc2l0aW9uKClcbiAgICAuZHVyYXRpb24oc2VsZi5vcHRpb25zLmFuaW1hdGlvbi5kdXJhdGlvbilcbiAgICAuZGVsYXkoZnVuY3Rpb24gKGQsIGkpIHtcbiAgICAgIC8vIGRlbGF5IGJldHdlZW4gZWFjaCBpdGVtXG4gICAgICByZXR1cm4gaSAqIHNlbGYub3B0aW9ucy5hbmltYXRpb24uZGVsYXk7XG4gICAgfSlcbiAgICAuZWFzZShcImVsYXN0aWNcIilcbiAgICAuYXR0clR3ZWVuKFwiZFwiLCBmdW5jdGlvbiAoaXRlbSkge1xuICAgICAgdmFyIGludGVycG9sYXRvciA9IGQzLmludGVycG9sYXRlTnVtYmVyKGl0ZW0uZnJvbVBlcmNlbnRhZ2UsIGl0ZW0ucGVyY2VudGFnZSk7XG4gICAgICByZXR1cm4gZnVuY3Rpb24gKHQpIHtcbiAgICAgICAgaXRlbS5wZXJjZW50YWdlID0gaW50ZXJwb2xhdG9yKHQpO1xuICAgICAgICByZXR1cm4gc2VsZi5wcm9ncmVzcyhpdGVtKTtcbiAgICAgIH07XG4gICAgfSlcbiAgICAudHdlZW4oXCJjZW50ZXJcIiwgZnVuY3Rpb24gKGl0ZW0pIHtcbiAgICAgIC8vIEV4ZWN1dGUgY2FsbGJhY2tzIG9uIGVhY2ggbGluZVxuICAgICAgaWYgKHNlbGYub3B0aW9ucy5jZW50ZXIpIHtcbiAgICAgICAgdmFyIGludGVycG9sYXRlID0gc2VsZi5vcHRpb25zLnJvdW5kID8gZDMuaW50ZXJwb2xhdGVSb3VuZCA6IGQzLmludGVycG9sYXRlTnVtYmVyO1xuICAgICAgICB2YXIgaW50ZXJwb2xhdG9yID0gaW50ZXJwb2xhdGUoaXRlbS5wcmV2aW91c1ZhbHVlIHx8IDAsIGl0ZW0udmFsdWUpO1xuICAgICAgICByZXR1cm4gZnVuY3Rpb24gKHQpIHtcbiAgICAgICAgICBjZW50ZXJcbiAgICAgICAgICAgIC5zZWxlY3RBbGwoJ3RzcGFuJylcbiAgICAgICAgICAgIC5lYWNoKGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgICAgaWYgKHRoaXMuY2FsbGJhY2spIHtcbiAgICAgICAgICAgICAgICBkMy5zZWxlY3QodGhpcykudGV4dCh0aGlzLmNhbGxiYWNrKGludGVycG9sYXRvcih0KSwgaXRlbS5pbmRleCwgaXRlbSkpO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfTtcbiAgICAgIH1cbiAgICB9KVxuICAgIC50d2VlbihcImludGVycG9sYXRlLWNvbG9yXCIsIGZ1bmN0aW9uIChpdGVtKSB7XG4gICAgICBpZiAoaXRlbS5jb2xvci5pbnRlcnBvbGF0ZSAmJiBpdGVtLmNvbG9yLmludGVycG9sYXRlLmxlbmd0aCA9PSAyKSB7XG4gICAgICAgIHZhciBjb2xvckludGVycG9sYXRvciA9IGQzLmludGVycG9sYXRlSHNsKGl0ZW0uY29sb3IuaW50ZXJwb2xhdGVbMF0sIGl0ZW0uY29sb3IuaW50ZXJwb2xhdGVbMV0pO1xuXG4gICAgICAgIHJldHVybiBmdW5jdGlvbiAodCkge1xuICAgICAgICAgIHZhciBjb2xvciA9IGNvbG9ySW50ZXJwb2xhdG9yKGl0ZW0ucGVyY2VudGFnZSAvIDEwMCk7XG4gICAgICAgICAgZDMuc2VsZWN0KHRoaXMpLnN0eWxlKCdmaWxsJywgY29sb3IpO1xuICAgICAgICAgIGQzLnNlbGVjdCh0aGlzLnBhcmVudE5vZGUpLnNlbGVjdCgncGF0aC5iZycpLnN0eWxlKCdmaWxsJywgY29sb3IpO1xuICAgICAgICB9O1xuICAgICAgfVxuICAgIH0pXG4gICAgLnN0eWxlKFwiZmlsbFwiLCBmdW5jdGlvbiAoaXRlbSkge1xuICAgICAgaWYoaXRlbS5saW5lYXJHcmFkaWVudCkge1xuICAgICAgICByZXR1cm4gXCJub25lXCI7XG4gICAgICB9XG4gICAgICBpZiAoaXRlbS5jb2xvci5zb2xpZCkge1xuICAgICAgICByZXR1cm4gaXRlbS5jb2xvci5zb2xpZDtcbiAgICAgIH1cblxuICAgICAgaWYgKGl0ZW0uY29sb3IubGluZWFyR3JhZGllbnQgfHwgaXRlbS5jb2xvci5yYWRpYWxHcmFkaWVudCkge1xuICAgICAgICByZXR1cm4gXCJ1cmwoI2dyYWRpZW50XCIgKyBpdGVtLmluZGV4ICsgJyknO1xuICAgICAgfVxuICAgIH0pO1xufTtcblxuLyoqXG4gKiBSZW1vdmUgc3ZnIGFuZCBjbGVhbiBzb21lIHJlZmVyZW5jZXNcbiAqL1xuUmFkaWFsUHJvZ3Jlc3NDaGFydC5wcm90b3R5cGUuZGVzdHJveSA9IGZ1bmN0aW9uICgpIHtcbiAgdGhpcy5zdmcucmVtb3ZlKCk7XG4gIGRlbGV0ZSB0aGlzLnN2Zztcbn07XG5cbi8qKlxuICogRGV0YWNoIGFuZCBub3JtYWxpemUgdXNlcidzIG9wdGlvbnMgaW5wdXQuXG4gKi9cblJhZGlhbFByb2dyZXNzQ2hhcnQubm9ybWFsaXplT3B0aW9ucyA9IGZ1bmN0aW9uIChvcHRpb25zKSB7XG4gIGlmICghb3B0aW9ucyB8fCB0eXBlb2Ygb3B0aW9ucyAhPT0gJ29iamVjdCcpIHtcbiAgICBvcHRpb25zID0ge307XG4gIH1cblxuICB2YXIgX29wdGlvbnMgPSB7XG4gICAgZGlhbWV0ZXI6IG9wdGlvbnMuZGlhbWV0ZXIgfHwgMTAwLFxuICAgIHN0cm9rZToge1xuICAgICAgd2lkdGg6IG9wdGlvbnMuc3Ryb2tlICYmIG9wdGlvbnMuc3Ryb2tlLndpZHRoIHx8IDQwLFxuICAgICAgZ2FwOiBvcHRpb25zLnN0cm9rZSAmJiBvcHRpb25zLnN0cm9rZS5nYXAgfHwgMlxuICAgIH0sXG4gICAgc2hhZG93OiB7XG4gICAgICB3aWR0aDogKCFvcHRpb25zLnNoYWRvdyB8fCBvcHRpb25zLnNoYWRvdy53aWR0aCA9PT0gbnVsbCkgPyA0IDogb3B0aW9ucy5zaGFkb3cud2lkdGhcbiAgICB9LFxuICAgIGFuaW1hdGlvbjoge1xuICAgICAgZHVyYXRpb246IG9wdGlvbnMuYW5pbWF0aW9uICYmIG9wdGlvbnMuYW5pbWF0aW9uLmR1cmF0aW9uIHx8IDE3NTAsXG4gICAgICBkZWxheTogb3B0aW9ucy5hbmltYXRpb24gJiYgb3B0aW9ucy5hbmltYXRpb24uZGVsYXkgfHwgMjAwXG4gICAgfSxcbiAgICBtaW46IG9wdGlvbnMubWluIHx8IDAsXG4gICAgbWF4OiBvcHRpb25zLm1heCB8fCAxMDAsXG4gICAgcm91bmQ6IG9wdGlvbnMucm91bmQgIT09IHVuZGVmaW5lZCA/ICEhb3B0aW9ucy5yb3VuZCA6IHRydWUsXG4gICAgc2VyaWVzOiBvcHRpb25zLnNlcmllcyB8fCBbXSxcbiAgICBjZW50ZXI6IFJhZGlhbFByb2dyZXNzQ2hhcnQubm9ybWFsaXplQ2VudGVyKG9wdGlvbnMuY2VudGVyKSxcbiAgfTtcblxuICB2YXIgZGVmYXVsdENvbG9yc0l0ZXJhdG9yID0gbmV3IFJhZGlhbFByb2dyZXNzQ2hhcnQuQ29sb3JzSXRlcmF0b3IoKTtcbiAgZm9yICh2YXIgaSA9IDAsIGxlbmd0aCA9IF9vcHRpb25zLnNlcmllcy5sZW5ndGg7IGkgPCBsZW5ndGg7IGkrKykge1xuICAgIHZhciBpdGVtID0gb3B0aW9ucy5zZXJpZXNbaV07XG5cbiAgICAvLyBjb252ZXJ0IG51bWJlciB0byBvYmplY3RcbiAgICBpZiAodHlwZW9mIGl0ZW0gPT09ICdudW1iZXInKSB7XG4gICAgICBpdGVtID0ge3ZhbHVlOiBpdGVtfTtcbiAgICB9XG5cbiAgICBfb3B0aW9ucy5zZXJpZXNbaV0gPSB7XG4gICAgICBpbmRleDogaSxcbiAgICAgIHZhbHVlOiBpdGVtLnZhbHVlLFxuICAgICAgbGFiZWxTdGFydDogaXRlbS5sYWJlbFN0YXJ0LFxuICAgICAgZmlsbDogaXRlbS5maWxsIHx8wqAnIzAwMDAwJyxcbiAgICAgIHJldmVyc2U6IGl0ZW0ucmV2ZXJzZSB8fMKgZmFsc2UsXG4gICAgICBsaW5lYXJHcmFkaWVudDogaXRlbS5saW5lYXJHcmFkaWVudCB8fMKgbnVsbCxcbiAgICAgIGNvbG9yOiBSYWRpYWxQcm9ncmVzc0NoYXJ0Lm5vcm1hbGl6ZUNvbG9yKGl0ZW0uY29sb3IsIGRlZmF1bHRDb2xvcnNJdGVyYXRvcilcbiAgICB9O1xuICB9XG5cbiAgcmV0dXJuIF9vcHRpb25zO1xufTtcblxuLyoqXG4gKiBOb3JtYWxpemUgZGlmZmVyZW50IG5vdGF0aW9ucyBvZiBjb2xvciBwcm9wZXJ0eVxuICpcbiAqIEBwYXJhbSB7U3RyaW5nfEFycmF5fE9iamVjdH0gY29sb3JcbiAqIEBleGFtcGxlICcjZmUwOGI1J1xuICogQGV4YW1wbGUgeyBzb2xpZDogJyNmZTA4YjUnLCBiYWNrZ3JvdW5kOiAnIzAwMDAwMCcgfVxuICogQGV4YW1wbGUgWycjMDAwMDAwJywgJyNmZjAwMDAnXVxuICogQGV4YW1wbGUge1xuICAgICAgICAgICAgICAgIGxpbmVhckdyYWRpZW50OiB7IHgxOiAnMCUnLCB5MTogJzEwMCUnLCB4MjogJzUwJScsIHkyOiAnMCUnfSxcbiAgICAgICAgICAgICAgICBzdG9wczogW1xuICAgICAgICAgICAgICAgICAge29mZnNldDogJzAlJywgJ3N0b3AtY29sb3InOiAnI2ZlMDhiNScsICdzdG9wLW9wYWNpdHknOiAxfSxcbiAgICAgICAgICAgICAgICAgIHtvZmZzZXQ6ICcxMDAlJywgJ3N0b3AtY29sb3InOiAnI2ZmMTQxMCcsICdzdG9wLW9wYWNpdHknOiAxfVxuICAgICAgICAgICAgICAgIF1cbiAgICAgICAgICAgICAgfVxuICogQGV4YW1wbGUge1xuICAgICAgICAgICAgICAgIHJhZGlhbEdyYWRpZW50OiB7Y3g6ICc2MCcsIGN5OiAnNjAnLCByOiAnNTAnfSxcbiAgICAgICAgICAgICAgICBzdG9wczogW1xuICAgICAgICAgICAgICAgICAge29mZnNldDogJzAlJywgJ3N0b3AtY29sb3InOiAnI2ZlMDhiNScsICdzdG9wLW9wYWNpdHknOiAxfSxcbiAgICAgICAgICAgICAgICAgIHtvZmZzZXQ6ICcxMDAlJywgJ3N0b3AtY29sb3InOiAnI2ZmMTQxMCcsICdzdG9wLW9wYWNpdHknOiAxfVxuICAgICAgICAgICAgICAgIF1cbiAgICAgICAgICAgICAgfVxuICpcbiAqL1xuUmFkaWFsUHJvZ3Jlc3NDaGFydC5ub3JtYWxpemVDb2xvciA9IGZ1bmN0aW9uIChjb2xvciwgZGVmYXVsdENvbG9yc0l0ZXJhdG9yKSB7XG5cbiAgaWYgKCFjb2xvcikge1xuICAgIGNvbG9yID0ge3NvbGlkOiBkZWZhdWx0Q29sb3JzSXRlcmF0b3IubmV4dCgpfTtcbiAgfSBlbHNlIGlmICh0eXBlb2YgY29sb3IgPT09ICdzdHJpbmcnKSB7XG4gICAgY29sb3IgPSB7c29saWQ6IGNvbG9yfTtcbiAgfSBlbHNlIGlmIChBcnJheS5pc0FycmF5KGNvbG9yKSkge1xuICAgIGNvbG9yID0ge2ludGVycG9sYXRlOiBjb2xvcn07XG4gIH0gZWxzZSBpZiAodHlwZW9mIGNvbG9yID09PSAnb2JqZWN0Jykge1xuICAgIGlmICghY29sb3Iuc29saWQgJiYgIWNvbG9yLmludGVycG9sYXRlICYmICFjb2xvci5saW5lYXJHcmFkaWVudCAmJiAhY29sb3IucmFkaWFsR3JhZGllbnQpIHtcbiAgICAgIGNvbG9yLnNvbGlkID0gZGVmYXVsdENvbG9yc0l0ZXJhdG9yLm5leHQoKTtcbiAgICB9XG4gIH1cblxuICAvLyBWYWxpZGF0ZSBpbnRlcnBvbGF0ZSBzeW50YXhcbiAgaWYgKGNvbG9yLmludGVycG9sYXRlKSB7XG4gICAgaWYgKGNvbG9yLmludGVycG9sYXRlLmxlbmd0aCAhPT0gMikge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKCdpbnRlcnBvbGF0ZSBhcnJheSBzaG91bGQgY29udGFpbiB0d28gY29sb3JzJyk7XG4gICAgfVxuICB9XG5cbiAgLy8gVmFsaWRhdGUgZ3JhZGllbnQgc3ludGF4XG4gIGlmIChjb2xvci5saW5lYXJHcmFkaWVudCB8fCBjb2xvci5yYWRpYWxHcmFkaWVudCkge1xuICAgIGlmICghY29sb3Iuc3RvcHMgfHwgIUFycmF5LmlzQXJyYXkoY29sb3Iuc3RvcHMpIHx8IGNvbG9yLnN0b3BzLmxlbmd0aCAhPT0gMikge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKCdncmFkaWVudCBzeW50YXggaXMgbWFsZm9ybWVkJyk7XG4gICAgfVxuICB9XG5cbiAgLy8gU2V0IGJhY2tncm91bmQgd2hlbiBpcyBub3QgcHJvdmlkZWRcbiAgaWYgKCFjb2xvci5iYWNrZ3JvdW5kKSB7XG4gICAgaWYgKGNvbG9yLnNvbGlkKSB7XG4gICAgICBjb2xvci5iYWNrZ3JvdW5kID0gY29sb3Iuc29saWQ7XG4gICAgfSBlbHNlIGlmIChjb2xvci5pbnRlcnBvbGF0ZSkge1xuICAgICAgY29sb3IuYmFja2dyb3VuZCA9IGNvbG9yLmludGVycG9sYXRlWzBdO1xuICAgIH0gZWxzZSBpZiAoY29sb3IubGluZWFyR3JhZGllbnQgfHwgY29sb3IucmFkaWFsR3JhZGllbnQpIHtcbiAgICAgIGNvbG9yLmJhY2tncm91bmQgPSBjb2xvci5zdG9wc1swXVsnc3RvcC1jb2xvciddO1xuICAgIH1cbiAgfVxuXG4gIHJldHVybiBjb2xvcjtcblxufTtcblxuXG4vKipcbiAqIE5vcm1hbGl6ZSBkaWZmZXJlbnQgbm90YXRpb25zIG9mIGNlbnRlciBwcm9wZXJ0eVxuICpcbiAqIEBwYXJhbSB7U3RyaW5nfEFycmF5fEZ1bmN0aW9ufE9iamVjdH0gY2VudGVyXG4gKiBAZXhhbXBsZSAnZm9vIGJhcidcbiAqIEBleGFtcGxlIHsgY29udGVudDogJ2ZvbyBiYXInLCB4OiAxMCwgeTogNCB9XG4gKiBAZXhhbXBsZSBmdW5jdGlvbih2YWx1ZSwgaW5kZXgsIGl0ZW0pIHt9XG4gKiBAZXhhbXBsZSBbJ2ZvbyBiYXInLCBmdW5jdGlvbih2YWx1ZSwgaW5kZXgsIGl0ZW0pIHt9XVxuICovXG5SYWRpYWxQcm9ncmVzc0NoYXJ0Lm5vcm1hbGl6ZUNlbnRlciA9IGZ1bmN0aW9uIChjZW50ZXIpIHtcbiAgaWYgKCFjZW50ZXIpIHJldHVybiBudWxsO1xuXG4gIC8vIENvbnZlcnQgdG8gb2JqZWN0IG5vdGF0aW9uXG4gIGlmIChjZW50ZXIuY29uc3RydWN0b3IgIT09IE9iamVjdCkge1xuICAgIGNlbnRlciA9IHtjb250ZW50OiBjZW50ZXJ9O1xuICB9XG5cbiAgLy8gRGVmYXVsdHNcbiAgY2VudGVyLmNvbnRlbnQgPSBjZW50ZXIuY29udGVudCB8fCBbXTtcbiAgY2VudGVyLnggPSBjZW50ZXIueCB8fCAwO1xuICBjZW50ZXIueSA9IGNlbnRlci55IHx8IDA7XG5cbiAgLy8gQ29udmVydCBjb250ZW50IHRvIGFycmF5IG5vdGF0aW9uXG4gIGlmICghQXJyYXkuaXNBcnJheShjZW50ZXIuY29udGVudCkpIHtcbiAgICBjZW50ZXIuY29udGVudCA9IFtjZW50ZXIuY29udGVudF07XG4gIH1cblxuICByZXR1cm4gY2VudGVyO1xufTtcblxuLy8gTGluZWFyIG9yIFJhZGlhbCBHcmFkaWVudCBpbnRlcm5hbCBvYmplY3RcblJhZGlhbFByb2dyZXNzQ2hhcnQuR3JhZGllbnQgPSAoZnVuY3Rpb24gKCkge1xuICBmdW5jdGlvbiBHcmFkaWVudCgpIHtcbiAgfVxuXG4gIEdyYWRpZW50LnRvU1ZHRWxlbWVudCA9IGZ1bmN0aW9uIChpZCwgb3B0aW9ucykge1xuICAgIHZhciBncmFkaWVudFR5cGUgPSBvcHRpb25zLmxpbmVhckdyYWRpZW50ID8gJ2xpbmVhckdyYWRpZW50JyA6ICdyYWRpYWxHcmFkaWVudCc7XG4gICAgdmFyIGdyYWRpZW50ID0gZDMuc2VsZWN0KGRvY3VtZW50LmNyZWF0ZUVsZW1lbnROUyhkMy5ucy5wcmVmaXguc3ZnLCBncmFkaWVudFR5cGUpKVxuICAgICAgLmF0dHIob3B0aW9uc1tncmFkaWVudFR5cGVdKVxuICAgICAgLmF0dHIoJ2lkJywgaWQpO1xuXG4gICAgb3B0aW9ucy5zdG9wcy5mb3JFYWNoKGZ1bmN0aW9uIChzdG9wQXR0cnMpIHtcbiAgICAgIGdyYWRpZW50LmFwcGVuZChcInN2ZzpzdG9wXCIpLmF0dHIoc3RvcEF0dHJzKTtcbiAgICB9KTtcblxuICAgIHRoaXMuYmFja2dyb3VuZCA9IG9wdGlvbnMuc3RvcHNbMF1bJ3N0b3AtY29sb3InXTtcblxuICAgIHJldHVybiBncmFkaWVudC5ub2RlKCk7XG4gIH07XG5cbiAgcmV0dXJuIEdyYWRpZW50O1xufSkoKTtcblxuLy8gRGVmYXVsdCBjb2xvcnMgaXRlcmF0b3JcblJhZGlhbFByb2dyZXNzQ2hhcnQuQ29sb3JzSXRlcmF0b3IgPSAoZnVuY3Rpb24gKCkge1xuXG4gIENvbG9yc0l0ZXJhdG9yLkRFRkFVTFRfQ09MT1JTID0gW1wiIzFhZDVkZVwiLCBcIiNhMGZmMDNcIiwgXCIjZTkwYjNhXCIsICcjZmY5NTAwJywgJyMwMDdhZmYnLCAnI2ZmY2MwMCcsICcjNTg1NmQ2JywgJyM4ZThlOTMnXTtcblxuICBmdW5jdGlvbiBDb2xvcnNJdGVyYXRvcigpIHtcbiAgICB0aGlzLmluZGV4ID0gMDtcbiAgfVxuXG4gIENvbG9yc0l0ZXJhdG9yLnByb3RvdHlwZS5uZXh0ID0gZnVuY3Rpb24gKCkge1xuICAgIGlmICh0aGlzLmluZGV4ID09PSBDb2xvcnNJdGVyYXRvci5ERUZBVUxUX0NPTE9SUy5sZW5ndGgpIHtcbiAgICAgIHRoaXMuaW5kZXggPSAwO1xuICAgIH1cblxuICAgIHJldHVybiBDb2xvcnNJdGVyYXRvci5ERUZBVUxUX0NPTE9SU1t0aGlzLmluZGV4KytdO1xuICB9O1xuXG4gIHJldHVybiBDb2xvcnNJdGVyYXRvcjtcbn0pKCk7XG5cblxuLy8gRXhwb3J0IFJhZGlhbFByb2dyZXNzQ2hhcnQgb2JqZWN0XG5pZiAodHlwZW9mIG1vZHVsZSAhPT0gXCJ1bmRlZmluZWRcIiltb2R1bGUuZXhwb3J0cyA9IFJhZGlhbFByb2dyZXNzQ2hhcnQ7Il19
