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

  // add linear gradient to stroke
  defs = self.svg.append("svg:defs"); 
  var gradientId = "gradient-" + Math.random(); 
  var gradient = defs.append("linearGradient"); 

  series.forEach(function (item) {
    console.log("linear gradient", item);
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

  self.field.append("path").attr("class", "progress").attr("filter", "url(#" + dropshadowId +")")
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
//# sourceMappingURL=data:application/json;charset:utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJpbmRleC5qcyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTtBQ0FBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EiLCJmaWxlIjoiZ2VuZXJhdGVkLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXNDb250ZW50IjpbIihmdW5jdGlvbiBlKHQsbixyKXtmdW5jdGlvbiBzKG8sdSl7aWYoIW5bb10pe2lmKCF0W29dKXt2YXIgYT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2lmKCF1JiZhKXJldHVybiBhKG8sITApO2lmKGkpcmV0dXJuIGkobywhMCk7dmFyIGY9bmV3IEVycm9yKFwiQ2Fubm90IGZpbmQgbW9kdWxlICdcIitvK1wiJ1wiKTt0aHJvdyBmLmNvZGU9XCJNT0RVTEVfTk9UX0ZPVU5EXCIsZn12YXIgbD1uW29dPXtleHBvcnRzOnt9fTt0W29dWzBdLmNhbGwobC5leHBvcnRzLGZ1bmN0aW9uKGUpe3ZhciBuPXRbb11bMV1bZV07cmV0dXJuIHMobj9uOmUpfSxsLGwuZXhwb3J0cyxlLHQsbixyKX1yZXR1cm4gbltvXS5leHBvcnRzfXZhciBpPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7Zm9yKHZhciBvPTA7bzxyLmxlbmd0aDtvKyspcyhyW29dKTtyZXR1cm4gc30pIiwiJ3VzZSBzdHJpY3QnO1xuXG52YXIgZDM7XG5cbi8vIFJhZGlhbFByb2dyZXNzQ2hhcnQgb2JqZWN0XG5mdW5jdGlvbiBSYWRpYWxQcm9ncmVzc0NoYXJ0KHF1ZXJ5LCBvcHRpb25zKSB7XG5cbiAgLy8gdmVyaWZ5IGQzIGlzIGxvYWRlZFxuICBkMyA9ICh0eXBlb2Ygd2luZG93ICE9PSAndW5kZWZpbmVkJyAmJiB3aW5kb3cuZDMpID8gd2luZG93LmQzIDogdHlwZW9mIHJlcXVpcmUgIT09ICd1bmRlZmluZWQnID8gcmVxdWlyZShcImQzXCIpIDogdW5kZWZpbmVkO1xuICBpZighZDMpIHRocm93IG5ldyBFcnJvcignZDMgb2JqZWN0IGlzIG1pc3NpbmcuIEQzLmpzIGxpYnJhcnkgaGFzIHRvIGJlIGxvYWRlZCBiZWZvcmUuJyk7XG5cbiAgdmFyIHNlbGYgPSB0aGlzO1xuICBzZWxmLm9wdGlvbnMgPSBSYWRpYWxQcm9ncmVzc0NoYXJ0Lm5vcm1hbGl6ZU9wdGlvbnMob3B0aW9ucyk7XG5cbiAgLy8gaW50ZXJuYWwgIHZhcmlhYmxlc1xuICB2YXIgc2VyaWVzID0gc2VsZi5vcHRpb25zLnNlcmllc1xuICAgICwgd2lkdGggPSAxNSArICgoc2VsZi5vcHRpb25zLmRpYW1ldGVyIC8gMikgKyAoc2VsZi5vcHRpb25zLnN0cm9rZS53aWR0aCAqIHNlbGYub3B0aW9ucy5zZXJpZXMubGVuZ3RoKSArIChzZWxmLm9wdGlvbnMuc3Ryb2tlLmdhcCAqIHNlbGYub3B0aW9ucy5zZXJpZXMubGVuZ3RoIC0gMSkpICogMlxuICAgICwgaGVpZ2h0ID0gd2lkdGhcbiAgICAsIGRpbSA9IFwiMCAwIFwiICsgaGVpZ2h0ICsgXCIgXCIgKyB3aWR0aFxuICAgICwgz4QgPSAyICogTWF0aC5QSVxuICAgICwgaW5uZXIgPSBbXVxuICAgICwgb3V0ZXIgPSBbXTtcblxuICBmdW5jdGlvbiBpbm5lclJhZGl1cyhpdGVtKSB7XG4gICAgdmFyIHJhZGl1cyA9IGlubmVyW2l0ZW0uaW5kZXhdO1xuICAgIGlmIChyYWRpdXMpIHJldHVybiByYWRpdXM7XG5cbiAgICAvLyBmaXJzdCByaW5nIGJhc2VkIG9uIGRpYW1ldGVyIGFuZCB0aGUgcmVzdCBiYXNlZCBvbiB0aGUgcHJldmlvdXMgb3V0ZXIgcmFkaXVzIHBsdXMgZ2FwXG4gICAgcmFkaXVzID0gaXRlbS5pbmRleCA9PT0gMCA/IHNlbGYub3B0aW9ucy5kaWFtZXRlciAvIDIgOiBvdXRlcltpdGVtLmluZGV4IC0gMV0gKyBzZWxmLm9wdGlvbnMuc3Ryb2tlLmdhcDtcbiAgICBpbm5lcltpdGVtLmluZGV4XSA9IHJhZGl1cztcbiAgICByZXR1cm4gcmFkaXVzO1xuICB9XG5cbiAgZnVuY3Rpb24gb3V0ZXJSYWRpdXMoaXRlbSkge1xuICAgIHZhciByYWRpdXMgPSBvdXRlcltpdGVtLmluZGV4XTtcbiAgICBpZiAocmFkaXVzKSByZXR1cm4gcmFkaXVzO1xuXG4gICAgLy8gYmFzZWQgb24gdGhlIHByZXZpb3VzIGlubmVyIHJhZGl1cyArIHN0cm9rZSB3aWR0aFxuICAgIHJhZGl1cyA9IGlubmVyW2l0ZW0uaW5kZXhdICsgc2VsZi5vcHRpb25zLnN0cm9rZS53aWR0aDtcbiAgICBvdXRlcltpdGVtLmluZGV4XSA9IHJhZGl1cztcbiAgICByZXR1cm4gcmFkaXVzO1xuICB9XG5cbiAgc2VsZi5wcm9ncmVzcyA9IGQzLnN2Zy5hcmMoKVxuICAgIC8vIC5zdGFydEFuZ2xlKDApXG4gICAgLy8gLmVuZEFuZ2xlKGZ1bmN0aW9uIChpdGVtKSB7XG4gICAgLy8gICByZXR1cm4gaXRlbS5wZXJjZW50YWdlIC8gMTAwICogz4Q7XG4gICAgLy8gfSlcblxuICAgIC5zdGFydEFuZ2xlKGZ1bmN0aW9uKGl0ZW0pIHtcbiAgICAgIGlmKGl0ZW0ucmV2ZXJzZSkge1xuICAgICAgICByZXR1cm4gz4Q7XG4gICAgICB9XG4gICAgICByZXR1cm4gMDtcbiAgICB9KVxuICAgIC5lbmRBbmdsZShmdW5jdGlvbiAoaXRlbSkge1xuICAgICAgaWYoaXRlbS5yZXZlcnNlKSB7XG4gICAgICAgIGNvbnNvbGUubG9nKFwiZW5kXCIsIGl0ZW0ubGFiZWxTdGFydCwgz4QgLSAoaXRlbS5wZXJjZW50YWdlIC8gMTAwICogz4QpKTtcbiAgICAgICAgcmV0dXJuIM+EIC0gKGl0ZW0ucGVyY2VudGFnZSAvIDEwMCAqIM+EKTtcbiAgICAgIH1cbiAgICAgIHJldHVybiBpdGVtLnBlcmNlbnRhZ2UgLyAxMDAgKiDPhDtcbiAgICB9KVxuICAgIC5pbm5lclJhZGl1cyhpbm5lclJhZGl1cylcbiAgICAub3V0ZXJSYWRpdXMob3V0ZXJSYWRpdXMpXG4gICAgLmNvcm5lclJhZGl1cyhmdW5jdGlvbiAoZCkge1xuICAgICAgLy8gV29ya2Fyb3VuZCBmb3IgZDMgYnVnIGh0dHBzOi8vZ2l0aHViLmNvbS9tYm9zdG9jay9kMy9pc3N1ZXMvMjI0OVxuICAgICAgLy8gUmVkdWNlIGNvcm5lciByYWRpdXMgd2hlbiBjb3JuZXJzIGFyZSBjbG9zZSBlYWNoIG90aGVyXG4gICAgICB2YXIgbSA9IGQucGVyY2VudGFnZSA+PSA5MCA/ICgxMDAgLSBkLnBlcmNlbnRhZ2UpICogMC4xIDogMTtcbiAgICAgIHJldHVybiAoc2VsZi5vcHRpb25zLnN0cm9rZS53aWR0aCAvIDIpICogbTtcbiAgICB9KTtcblxuICB2YXIgYmFja2dyb3VuZCA9IGQzLnN2Zy5hcmMoKVxuICAgIC5zdGFydEFuZ2xlKDApXG4gICAgLmVuZEFuZ2xlKM+EKVxuICAgIC5pbm5lclJhZGl1cyhpbm5lclJhZGl1cylcbiAgICAub3V0ZXJSYWRpdXMob3V0ZXJSYWRpdXMpO1xuXG4gIC8vIGNyZWF0ZSBzdmdcbiAgc2VsZi5zdmcgPSBkMy5zZWxlY3QocXVlcnkpLmFwcGVuZChcInN2Z1wiKVxuICAgIC5hdHRyKFwicHJlc2VydmVBc3BlY3RSYXRpb1wiLFwieE1pbllNaW4gbWVldFwiKVxuICAgIC5hdHRyKFwidmlld0JveFwiLCBkaW0pXG4gICAgLmFwcGVuZChcImdcIilcbiAgICAuYXR0cihcInRyYW5zZm9ybVwiLCBcInRyYW5zbGF0ZShcIiArIHdpZHRoIC8gMiArIFwiLFwiICsgaGVpZ2h0IC8gMiArIFwiKVwiKTtcblxuICAvLyBhZGQgZ3JhZGllbnRzIGRlZnNcbiAgdmFyIGRlZnMgPSBzZWxmLnN2Zy5hcHBlbmQoXCJzdmc6ZGVmc1wiKTtcbiAgc2VyaWVzLmZvckVhY2goZnVuY3Rpb24gKGl0ZW0pIHtcbiAgICBpZiAoaXRlbS5jb2xvci5saW5lYXJHcmFkaWVudCB8fCBpdGVtLmNvbG9yLnJhZGlhbEdyYWRpZW50KSB7XG4gICAgICB2YXIgZ3JhZGllbnQgPSBSYWRpYWxQcm9ncmVzc0NoYXJ0LkdyYWRpZW50LnRvU1ZHRWxlbWVudCgnZ3JhZGllbnQnICsgaXRlbS5pbmRleCwgaXRlbS5jb2xvcik7XG4gICAgICBkZWZzLm5vZGUoKS5hcHBlbmRDaGlsZChncmFkaWVudCk7XG4gICAgfVxuICB9KTtcblxuICAvLyBhZGQgc2hhZG93cyBkZWZzXG4gIGRlZnMgPSBzZWxmLnN2Zy5hcHBlbmQoXCJzdmc6ZGVmc1wiKTtcbiAgdmFyIGRyb3BzaGFkb3dJZCA9IFwiZHJvcHNoYWRvdy1cIiArIE1hdGgucmFuZG9tKCk7XG4gIHZhciBmaWx0ZXIgPSBkZWZzLmFwcGVuZChcImZpbHRlclwiKS5hdHRyKFwiaWRcIiwgZHJvcHNoYWRvd0lkKTtcbiAgaWYoc2VsZi5vcHRpb25zLnNoYWRvdy53aWR0aCA+IDApIHtcbiAgICBcbiAgICBmaWx0ZXIuYXBwZW5kKFwiZmVHYXVzc2lhbkJsdXJcIilcbiAgICAgIC5hdHRyKFwiaW5cIiwgXCJTb3VyY2VBbHBoYVwiKVxuICAgICAgLmF0dHIoXCJzdGREZXZpYXRpb25cIiwgc2VsZi5vcHRpb25zLnNoYWRvdy53aWR0aClcbiAgICAgIC5hdHRyKFwicmVzdWx0XCIsIFwiYmx1clwiKTtcblxuICAgIGZpbHRlci5hcHBlbmQoXCJmZU9mZnNldFwiKVxuICAgICAgLmF0dHIoXCJpblwiLCBcImJsdXJcIilcbiAgICAgIC5hdHRyKFwiZHhcIiwgMSlcbiAgICAgIC5hdHRyKFwiZHlcIiwgMSlcbiAgICAgIC5hdHRyKFwicmVzdWx0XCIsIFwib2Zmc2V0Qmx1clwiKTtcbiAgfVxuXG4gIHZhciBmZU1lcmdlID0gZmlsdGVyLmFwcGVuZChcImZlTWVyZ2VcIik7XG4gIGZlTWVyZ2UuYXBwZW5kKFwiZmVNZXJnZU5vZGVcIikuYXR0cihcImluXCIsIFwib2Zmc2V0Qmx1clwiKTtcbiAgZmVNZXJnZS5hcHBlbmQoXCJmZU1lcmdlTm9kZVwiKS5hdHRyKFwiaW5cIiwgXCJTb3VyY2VHcmFwaGljXCIpO1xuXG4gIC8vIGFkZCBsaW5lYXIgZ3JhZGllbnQgdG8gc3Ryb2tlXG4gIGRlZnMgPSBzZWxmLnN2Zy5hcHBlbmQoXCJzdmc6ZGVmc1wiKTsgXG4gIHZhciBncmFkaWVudElkID0gXCJncmFkaWVudC1cIiArIE1hdGgucmFuZG9tKCk7IFxuICB2YXIgZ3JhZGllbnQgPSBkZWZzLmFwcGVuZChcImxpbmVhckdyYWRpZW50XCIpOyBcblxuICBzZXJpZXMuZm9yRWFjaChmdW5jdGlvbiAoaXRlbSkge1xuICAgIGNvbnNvbGUubG9nKFwibGluZWFyIGdyYWRpZW50XCIsIGl0ZW0pO1xuICAgIGlmKGl0ZW0ubGluZWFyR3JhZGllbnQpIHtcbiAgICAgIGZvcih2YXIgaT0wOyBpPGl0ZW0ubGluZWFyR3JhZGllbnQuc3RvcHMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgdmFyIHN0b3AgPSBpdGVtLmxpbmVhckdyYWRpZW50LnN0b3BzW2ldO1xuICAgICAgICBncmFkaWVudC5hcHBlbmQoXCJzdG9wXCIpXG4gICAgICAgICAgLmF0dHIoXCJvZmZzZXRcIiwgc3RvcC5vZmZzZXQpXG4gICAgICAgICAgLmF0dHIoXCJzdG9wLWNvbG9yXCIsIHN0b3BbJ3N0b3AtY29sb3InXSlcbiAgICAgICAgICAuYXR0cihcInN0b3Atb3BhY2l0eVwiLCBzdG9wWydzdG9wLW9wYWNpdHknXSk7XG4gICAgICB9XG5cbiAgICB9XG4gIH0pO1xuXG5cbiAgLy8gYWRkIGlubmVyIHRleHRcbiAgaWYgKHNlbGYub3B0aW9ucy5jZW50ZXIpIHtcbiAgICBzZWxmLnN2Zy5hcHBlbmQoXCJ0ZXh0XCIpXG4gICAgICAuYXR0cignY2xhc3MnLCAncmJjLWNlbnRlci10ZXh0JylcbiAgICAgIC5hdHRyKFwidGV4dC1hbmNob3JcIiwgXCJtaWRkbGVcIilcbiAgICAgIC5hdHRyKCd4Jywgc2VsZi5vcHRpb25zLmNlbnRlci54ICsgJ3B4JylcbiAgICAgIC5hdHRyKCd5Jywgc2VsZi5vcHRpb25zLmNlbnRlci55ICsgJ3B4JylcbiAgICAgIC5zZWxlY3RBbGwoJ3RzcGFuJylcbiAgICAgIC5kYXRhKHNlbGYub3B0aW9ucy5jZW50ZXIuY29udGVudCkuZW50ZXIoKVxuICAgICAgLmFwcGVuZCgndHNwYW4nKVxuICAgICAgLmF0dHIoXCJkb21pbmFudC1iYXNlbGluZVwiLCBmdW5jdGlvbiAoKSB7XG5cbiAgICAgICAgLy8gU2luZ2xlIGxpbmVzIGNhbiBlYXNpbHkgY2VudGVyZWQgaW4gdGhlIG1pZGRsZSB1c2luZyBkb21pbmFudC1iYXNlbGluZSwgbXVsdGlsaW5lIG5lZWQgdG8gdXNlIHlcbiAgICAgICAgaWYgKHNlbGYub3B0aW9ucy5jZW50ZXIuY29udGVudC5sZW5ndGggPT09IDEpIHtcbiAgICAgICAgICByZXR1cm4gJ2NlbnRyYWwnO1xuICAgICAgICB9XG4gICAgICB9KVxuICAgICAgLmF0dHIoJ2NsYXNzJywgZnVuY3Rpb24gKGQsIGkpIHtcbiAgICAgICAgcmV0dXJuICdyYmMtY2VudGVyLXRleHQtbGluZScgKyBpO1xuICAgICAgfSlcbiAgICAgIC5hdHRyKCd4JywgMClcbiAgICAgIC5hdHRyKCdkeScsIGZ1bmN0aW9uIChkLCBpKSB7XG4gICAgICAgIGlmIChpID4gMCkge1xuICAgICAgICAgIHJldHVybiAnMS4xZW0nO1xuICAgICAgICB9XG4gICAgICB9KVxuICAgICAgLmVhY2goZnVuY3Rpb24gKGQpIHtcbiAgICAgICAgaWYgKHR5cGVvZiBkID09PSAnZnVuY3Rpb24nKSB7XG4gICAgICAgICAgdGhpcy5jYWxsYmFjayA9IGQ7XG4gICAgICAgIH1cbiAgICAgIH0pXG4gICAgICAudGV4dChmdW5jdGlvbiAoZCkge1xuICAgICAgICBpZiAodHlwZW9mIGQgPT09ICdzdHJpbmcnKSB7XG4gICAgICAgICAgcmV0dXJuIGQ7XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gJyc7XG4gICAgICB9KTtcbiAgfVxuXG4gIC8vIGFkZCByaW5nIHN0cnVjdHVyZVxuICBzZWxmLmZpZWxkID0gc2VsZi5zdmcuc2VsZWN0QWxsKFwiZ1wiKVxuICAgIC5kYXRhKHNlcmllcylcbiAgICAuZW50ZXIoKS5hcHBlbmQoXCJnXCIpO1xuXG4gIHNlbGYuZmllbGQuYXBwZW5kKFwicGF0aFwiKS5hdHRyKFwiY2xhc3NcIiwgXCJwcm9ncmVzc1wiKS5hdHRyKFwiZmlsdGVyXCIsIFwidXJsKCNcIiArIGRyb3BzaGFkb3dJZCArXCIpXCIpXG4gICAgLmF0dHIoXCJzdHJva2VcIiwgZnVuY3Rpb24oaXRlbSkge1xuICAgICAgaWYoaXRlbS5saW5lYXJHcmFkaWVudCkge1xuICAgICAgICByZXR1cm4gXCJ1cmwoI1wiICsgZ3JhZGllbnRJZCArIFwiKVwiO1xuICAgICAgfVxuICAgIH0pO1xuICAgIC8vIC5zdHlsZShcInN0cm9rZS13aWR0aFwiLCA1KVxuICAgIC8vIC5zdHlsZShcInN0cm9rZVwiLCBcIndoaXRlXCIpO1xuXG4gIHNlbGYuZmllbGQuYXBwZW5kKFwicGF0aFwiKS5hdHRyKFwiY2xhc3NcIiwgXCJiZ1wiKVxuICAgIC5zdHlsZShcImZpbGxcIiwgZnVuY3Rpb24gKGl0ZW0pIHtcbiAgICAgIHJldHVybiBpdGVtLmNvbG9yLmJhY2tncm91bmQ7XG4gICAgfSlcbiAgICAuc3R5bGUoXCJvcGFjaXR5XCIsIDAuMilcbiAgICAuYXR0cihcImRcIiwgYmFja2dyb3VuZCk7XG5cbiAgc2VsZi5maWVsZC5hcHBlbmQoXCJ0ZXh0XCIpXG4gICAgLmNsYXNzZWQoJ3JiYy1sYWJlbCByYmMtbGFiZWwtc3RhcnQnLCB0cnVlKVxuICAgIC5hdHRyKFwiZG9taW5hbnQtYmFzZWxpbmVcIiwgXCJjZW50cmFsXCIpXG4gICAgLmF0dHIoXCJ4XCIsIFwiMTBcIilcbiAgICAuYXR0cihcInlcIiwgZnVuY3Rpb24gKGl0ZW0pIHtcbiAgICAgIHJldHVybiAtKFxuICAgICAgICBzZWxmLm9wdGlvbnMuZGlhbWV0ZXIgLyAyICtcbiAgICAgICAgaXRlbS5pbmRleCAqIChzZWxmLm9wdGlvbnMuc3Ryb2tlLmdhcCArIHNlbGYub3B0aW9ucy5zdHJva2Uud2lkdGgpICtcbiAgICAgICAgc2VsZi5vcHRpb25zLnN0cm9rZS53aWR0aCAvIDJcbiAgICAgICAgKTtcbiAgICB9KVxuICAgIC5zdHlsZShcImZpbGxcIiwgZnVuY3Rpb24oaXRlbSkge1xuICAgICAgICByZXR1cm4gaXRlbS5maWxsO1xuICAgIH0pXG4gICAgLnRleHQoZnVuY3Rpb24gKGl0ZW0pIHtcbiAgICAgIHJldHVybiBpdGVtLmxhYmVsU3RhcnQ7XG4gICAgfSk7XG5cbiAgc2VsZi51cGRhdGUoKTtcbn1cblxuLyoqXG4gKiBVcGRhdGUgZGF0YSB0byBiZSB2aXN1YWxpemVkIGluIHRoZSBjaGFydC5cbiAqXG4gKiBAcGFyYW0ge09iamVjdHxBcnJheX0gZGF0YSBPcHRpb25hbCBkYXRhIHlvdSdkIGxpa2UgdG8gc2V0IGZvciB0aGUgY2hhcnQgYmVmb3JlIGl0IHdpbGwgdXBkYXRlLiBJZiBub3Qgc3BlY2lmaWVkIHRoZSB1cGRhdGUgbWV0aG9kIHdpbGwgdXNlIHRoZSBkYXRhIHRoYXQgaXMgYWxyZWFkeSBjb25maWd1cmVkIHdpdGggdGhlIGNoYXJ0LlxuICogQGV4YW1wbGUgdXBkYXRlKFs3MCwgMTAsIDQ1XSlcbiAqIEBleGFtcGxlIHVwZGF0ZSh7c2VyaWVzOiBbe3ZhbHVlOiA3MH0sIDEwLCA0NV19KVxuICpcbiAqL1xuUmFkaWFsUHJvZ3Jlc3NDaGFydC5wcm90b3R5cGUudXBkYXRlID0gZnVuY3Rpb24gKGRhdGEpIHtcbiAgdmFyIHNlbGYgPSB0aGlzO1xuICBjb25zb2xlLmxvZyhcInVwZGF0aW5nIVwiLCBkYXRhKTtcblxuICAvLyBwYXJzZSBuZXcgZGF0YVxuICBpZiAoZGF0YSkge1xuICAgIGlmICh0eXBlb2YgZGF0YSA9PT0gJ251bWJlcicpIHtcbiAgICAgIGRhdGEgPSBbZGF0YV07XG4gICAgfVxuXG4gICAgdmFyIHNlcmllcztcblxuICAgIGlmIChBcnJheS5pc0FycmF5KGRhdGEpKSB7XG4gICAgICBzZXJpZXMgPSBkYXRhO1xuICAgIH0gZWxzZSBpZiAodHlwZW9mIGRhdGEgPT09ICdvYmplY3QnKSB7XG4gICAgICBzZXJpZXMgPSBkYXRhLnNlcmllcyB8fCBbXTtcbiAgICB9XG5cbiAgICBmb3IgKHZhciBpID0gMDsgaSA8IHNlcmllcy5sZW5ndGg7IGkrKykge1xuICAgICAgdGhpcy5vcHRpb25zLnNlcmllc1tpXS5wcmV2aW91c1ZhbHVlID0gdGhpcy5vcHRpb25zLnNlcmllc1tpXS52YWx1ZTtcblxuICAgICAgdmFyIGl0ZW0gPSBzZXJpZXNbaV07XG4gICAgICBpZiAodHlwZW9mIGl0ZW0gPT09ICdudW1iZXInKSB7XG4gICAgICAgIHRoaXMub3B0aW9ucy5zZXJpZXNbaV0udmFsdWUgPSBpdGVtO1xuICAgICAgfSBlbHNlIGlmICh0eXBlb2YgaXRlbSA9PT0gJ29iamVjdCcpIHtcbiAgICAgICAgdGhpcy5vcHRpb25zLnNlcmllc1tpXS52YWx1ZSA9IGl0ZW0udmFsdWU7XG4gICAgICAgIC8vIHVwZGF0ZSBpdGVtLmxhYmVsU3RhcnQgdmFsdWVcbiAgICAgICAgaWYoaXRlbS5sYWJlbFN0YXJ0KSB7XG4gICAgICAgICAgdGhpcy5vcHRpb25zLnNlcmllc1tpXS5sYWJlbFN0YXJ0ID0gaXRlbS5sYWJlbFN0YXJ0OyBcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIC8vIGNhbGN1bGF0ZSBmcm9tIHBlcmNlbnRhZ2UgYW5kIG5ldyBwZXJjZW50YWdlIGZvciB0aGUgcHJvZ3Jlc3MgYW5pbWF0aW9uXG4gIHNlbGYub3B0aW9ucy5zZXJpZXMuZm9yRWFjaChmdW5jdGlvbiAoaXRlbSkge1xuICAgIGl0ZW0uZnJvbVBlcmNlbnRhZ2UgPSBpdGVtLnBlcmNlbnRhZ2UgPyBpdGVtLnBlcmNlbnRhZ2UgOiA1O1xuICAgIGl0ZW0ucGVyY2VudGFnZSA9IChpdGVtLnZhbHVlIC0gc2VsZi5vcHRpb25zLm1pbikgKiAxMDAgLyAoc2VsZi5vcHRpb25zLm1heCAtIHNlbGYub3B0aW9ucy5taW4pO1xuICB9KTtcblxuICB2YXIgY2VudGVyID0gc2VsZi5zdmcuc2VsZWN0KFwidGV4dC5yYmMtY2VudGVyLXRleHRcIik7XG5cbiAgLy8gdXBkYXRlIGxhYmVsU3RhcnQgb24gdXBkYXRlXG4gIHNlbGYuZmllbGQuc2VsZWN0KFwidGV4dC5yYmMtbGFiZWwtc3RhcnRcIilcbiAgICAgIC50ZXh0KGZ1bmN0aW9uIChpdGVtKSB7XG4gICAgICByZXR1cm4gaXRlbS5sYWJlbFN0YXJ0O1xuICAgIH0pO1xuXG4gIC8vIHByb2dyZXNzXG4gIHNlbGYuZmllbGQuc2VsZWN0KFwicGF0aC5wcm9ncmVzc1wiKVxuICAgIC5pbnRlcnJ1cHQoKVxuICAgIC50cmFuc2l0aW9uKClcbiAgICAuZHVyYXRpb24oc2VsZi5vcHRpb25zLmFuaW1hdGlvbi5kdXJhdGlvbilcbiAgICAuZGVsYXkoZnVuY3Rpb24gKGQsIGkpIHtcbiAgICAgIC8vIGRlbGF5IGJldHdlZW4gZWFjaCBpdGVtXG4gICAgICByZXR1cm4gaSAqIHNlbGYub3B0aW9ucy5hbmltYXRpb24uZGVsYXk7XG4gICAgfSlcbiAgICAuZWFzZShcImVsYXN0aWNcIilcbiAgICAuYXR0clR3ZWVuKFwiZFwiLCBmdW5jdGlvbiAoaXRlbSkge1xuICAgICAgdmFyIGludGVycG9sYXRvciA9IGQzLmludGVycG9sYXRlTnVtYmVyKGl0ZW0uZnJvbVBlcmNlbnRhZ2UsIGl0ZW0ucGVyY2VudGFnZSk7XG4gICAgICByZXR1cm4gZnVuY3Rpb24gKHQpIHtcbiAgICAgICAgaXRlbS5wZXJjZW50YWdlID0gaW50ZXJwb2xhdG9yKHQpO1xuICAgICAgICByZXR1cm4gc2VsZi5wcm9ncmVzcyhpdGVtKTtcbiAgICAgIH07XG4gICAgfSlcbiAgICAudHdlZW4oXCJjZW50ZXJcIiwgZnVuY3Rpb24gKGl0ZW0pIHtcbiAgICAgIC8vIEV4ZWN1dGUgY2FsbGJhY2tzIG9uIGVhY2ggbGluZVxuICAgICAgaWYgKHNlbGYub3B0aW9ucy5jZW50ZXIpIHtcbiAgICAgICAgdmFyIGludGVycG9sYXRlID0gc2VsZi5vcHRpb25zLnJvdW5kID8gZDMuaW50ZXJwb2xhdGVSb3VuZCA6IGQzLmludGVycG9sYXRlTnVtYmVyO1xuICAgICAgICB2YXIgaW50ZXJwb2xhdG9yID0gaW50ZXJwb2xhdGUoaXRlbS5wcmV2aW91c1ZhbHVlIHx8IDAsIGl0ZW0udmFsdWUpO1xuICAgICAgICByZXR1cm4gZnVuY3Rpb24gKHQpIHtcbiAgICAgICAgICBjZW50ZXJcbiAgICAgICAgICAgIC5zZWxlY3RBbGwoJ3RzcGFuJylcbiAgICAgICAgICAgIC5lYWNoKGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgICAgaWYgKHRoaXMuY2FsbGJhY2spIHtcbiAgICAgICAgICAgICAgICBkMy5zZWxlY3QodGhpcykudGV4dCh0aGlzLmNhbGxiYWNrKGludGVycG9sYXRvcih0KSwgaXRlbS5pbmRleCwgaXRlbSkpO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfTtcbiAgICAgIH1cbiAgICB9KVxuICAgIC50d2VlbihcImludGVycG9sYXRlLWNvbG9yXCIsIGZ1bmN0aW9uIChpdGVtKSB7XG4gICAgICBpZiAoaXRlbS5jb2xvci5pbnRlcnBvbGF0ZSAmJiBpdGVtLmNvbG9yLmludGVycG9sYXRlLmxlbmd0aCA9PSAyKSB7XG4gICAgICAgIHZhciBjb2xvckludGVycG9sYXRvciA9IGQzLmludGVycG9sYXRlSHNsKGl0ZW0uY29sb3IuaW50ZXJwb2xhdGVbMF0sIGl0ZW0uY29sb3IuaW50ZXJwb2xhdGVbMV0pO1xuXG4gICAgICAgIHJldHVybiBmdW5jdGlvbiAodCkge1xuICAgICAgICAgIHZhciBjb2xvciA9IGNvbG9ySW50ZXJwb2xhdG9yKGl0ZW0ucGVyY2VudGFnZSAvIDEwMCk7XG4gICAgICAgICAgZDMuc2VsZWN0KHRoaXMpLnN0eWxlKCdmaWxsJywgY29sb3IpO1xuICAgICAgICAgIGQzLnNlbGVjdCh0aGlzLnBhcmVudE5vZGUpLnNlbGVjdCgncGF0aC5iZycpLnN0eWxlKCdmaWxsJywgY29sb3IpO1xuICAgICAgICB9O1xuICAgICAgfVxuICAgIH0pXG4gICAgLnN0eWxlKFwiZmlsbFwiLCBmdW5jdGlvbiAoaXRlbSkge1xuICAgICAgaWYgKGl0ZW0uY29sb3Iuc29saWQpIHtcbiAgICAgICAgcmV0dXJuIGl0ZW0uY29sb3Iuc29saWQ7XG4gICAgICB9XG5cbiAgICAgIGlmIChpdGVtLmNvbG9yLmxpbmVhckdyYWRpZW50IHx8IGl0ZW0uY29sb3IucmFkaWFsR3JhZGllbnQpIHtcbiAgICAgICAgcmV0dXJuIFwidXJsKCNncmFkaWVudFwiICsgaXRlbS5pbmRleCArICcpJztcbiAgICAgIH1cbiAgICB9KTtcbn07XG5cbi8qKlxuICogUmVtb3ZlIHN2ZyBhbmQgY2xlYW4gc29tZSByZWZlcmVuY2VzXG4gKi9cblJhZGlhbFByb2dyZXNzQ2hhcnQucHJvdG90eXBlLmRlc3Ryb3kgPSBmdW5jdGlvbiAoKSB7XG4gIHRoaXMuc3ZnLnJlbW92ZSgpO1xuICBkZWxldGUgdGhpcy5zdmc7XG59O1xuXG4vKipcbiAqIERldGFjaCBhbmQgbm9ybWFsaXplIHVzZXIncyBvcHRpb25zIGlucHV0LlxuICovXG5SYWRpYWxQcm9ncmVzc0NoYXJ0Lm5vcm1hbGl6ZU9wdGlvbnMgPSBmdW5jdGlvbiAob3B0aW9ucykge1xuICBpZiAoIW9wdGlvbnMgfHwgdHlwZW9mIG9wdGlvbnMgIT09ICdvYmplY3QnKSB7XG4gICAgb3B0aW9ucyA9IHt9O1xuICB9XG5cbiAgdmFyIF9vcHRpb25zID0ge1xuICAgIGRpYW1ldGVyOiBvcHRpb25zLmRpYW1ldGVyIHx8IDEwMCxcbiAgICBzdHJva2U6IHtcbiAgICAgIHdpZHRoOiBvcHRpb25zLnN0cm9rZSAmJiBvcHRpb25zLnN0cm9rZS53aWR0aCB8fCA0MCxcbiAgICAgIGdhcDogb3B0aW9ucy5zdHJva2UgJiYgb3B0aW9ucy5zdHJva2UuZ2FwIHx8IDJcbiAgICB9LFxuICAgIHNoYWRvdzoge1xuICAgICAgd2lkdGg6ICghb3B0aW9ucy5zaGFkb3cgfHwgb3B0aW9ucy5zaGFkb3cud2lkdGggPT09IG51bGwpID8gNCA6IG9wdGlvbnMuc2hhZG93LndpZHRoXG4gICAgfSxcbiAgICBhbmltYXRpb246IHtcbiAgICAgIGR1cmF0aW9uOiBvcHRpb25zLmFuaW1hdGlvbiAmJiBvcHRpb25zLmFuaW1hdGlvbi5kdXJhdGlvbiB8fCAxNzUwLFxuICAgICAgZGVsYXk6IG9wdGlvbnMuYW5pbWF0aW9uICYmIG9wdGlvbnMuYW5pbWF0aW9uLmRlbGF5IHx8IDIwMFxuICAgIH0sXG4gICAgbWluOiBvcHRpb25zLm1pbiB8fCAwLFxuICAgIG1heDogb3B0aW9ucy5tYXggfHwgMTAwLFxuICAgIHJvdW5kOiBvcHRpb25zLnJvdW5kICE9PSB1bmRlZmluZWQgPyAhIW9wdGlvbnMucm91bmQgOiB0cnVlLFxuICAgIHNlcmllczogb3B0aW9ucy5zZXJpZXMgfHwgW10sXG4gICAgY2VudGVyOiBSYWRpYWxQcm9ncmVzc0NoYXJ0Lm5vcm1hbGl6ZUNlbnRlcihvcHRpb25zLmNlbnRlciksXG4gIH07XG5cbiAgdmFyIGRlZmF1bHRDb2xvcnNJdGVyYXRvciA9IG5ldyBSYWRpYWxQcm9ncmVzc0NoYXJ0LkNvbG9yc0l0ZXJhdG9yKCk7XG4gIGZvciAodmFyIGkgPSAwLCBsZW5ndGggPSBfb3B0aW9ucy5zZXJpZXMubGVuZ3RoOyBpIDwgbGVuZ3RoOyBpKyspIHtcbiAgICB2YXIgaXRlbSA9IG9wdGlvbnMuc2VyaWVzW2ldO1xuXG4gICAgLy8gY29udmVydCBudW1iZXIgdG8gb2JqZWN0XG4gICAgaWYgKHR5cGVvZiBpdGVtID09PSAnbnVtYmVyJykge1xuICAgICAgaXRlbSA9IHt2YWx1ZTogaXRlbX07XG4gICAgfVxuXG4gICAgX29wdGlvbnMuc2VyaWVzW2ldID0ge1xuICAgICAgaW5kZXg6IGksXG4gICAgICB2YWx1ZTogaXRlbS52YWx1ZSxcbiAgICAgIGxhYmVsU3RhcnQ6IGl0ZW0ubGFiZWxTdGFydCxcbiAgICAgIGZpbGw6IGl0ZW0uZmlsbCB8fMKgJyMwMDAwMCcsXG4gICAgICByZXZlcnNlOiBpdGVtLnJldmVyc2UgfHzCoGZhbHNlLFxuICAgICAgbGluZWFyR3JhZGllbnQ6IGl0ZW0ubGluZWFyR3JhZGllbnQgfHzCoG51bGwsXG4gICAgICBjb2xvcjogUmFkaWFsUHJvZ3Jlc3NDaGFydC5ub3JtYWxpemVDb2xvcihpdGVtLmNvbG9yLCBkZWZhdWx0Q29sb3JzSXRlcmF0b3IpXG4gICAgfTtcbiAgfVxuXG4gIHJldHVybiBfb3B0aW9ucztcbn07XG5cbi8qKlxuICogTm9ybWFsaXplIGRpZmZlcmVudCBub3RhdGlvbnMgb2YgY29sb3IgcHJvcGVydHlcbiAqXG4gKiBAcGFyYW0ge1N0cmluZ3xBcnJheXxPYmplY3R9IGNvbG9yXG4gKiBAZXhhbXBsZSAnI2ZlMDhiNSdcbiAqIEBleGFtcGxlIHsgc29saWQ6ICcjZmUwOGI1JywgYmFja2dyb3VuZDogJyMwMDAwMDAnIH1cbiAqIEBleGFtcGxlIFsnIzAwMDAwMCcsICcjZmYwMDAwJ11cbiAqIEBleGFtcGxlIHtcbiAgICAgICAgICAgICAgICBsaW5lYXJHcmFkaWVudDogeyB4MTogJzAlJywgeTE6ICcxMDAlJywgeDI6ICc1MCUnLCB5MjogJzAlJ30sXG4gICAgICAgICAgICAgICAgc3RvcHM6IFtcbiAgICAgICAgICAgICAgICAgIHtvZmZzZXQ6ICcwJScsICdzdG9wLWNvbG9yJzogJyNmZTA4YjUnLCAnc3RvcC1vcGFjaXR5JzogMX0sXG4gICAgICAgICAgICAgICAgICB7b2Zmc2V0OiAnMTAwJScsICdzdG9wLWNvbG9yJzogJyNmZjE0MTAnLCAnc3RvcC1vcGFjaXR5JzogMX1cbiAgICAgICAgICAgICAgICBdXG4gICAgICAgICAgICAgIH1cbiAqIEBleGFtcGxlIHtcbiAgICAgICAgICAgICAgICByYWRpYWxHcmFkaWVudDoge2N4OiAnNjAnLCBjeTogJzYwJywgcjogJzUwJ30sXG4gICAgICAgICAgICAgICAgc3RvcHM6IFtcbiAgICAgICAgICAgICAgICAgIHtvZmZzZXQ6ICcwJScsICdzdG9wLWNvbG9yJzogJyNmZTA4YjUnLCAnc3RvcC1vcGFjaXR5JzogMX0sXG4gICAgICAgICAgICAgICAgICB7b2Zmc2V0OiAnMTAwJScsICdzdG9wLWNvbG9yJzogJyNmZjE0MTAnLCAnc3RvcC1vcGFjaXR5JzogMX1cbiAgICAgICAgICAgICAgICBdXG4gICAgICAgICAgICAgIH1cbiAqXG4gKi9cblJhZGlhbFByb2dyZXNzQ2hhcnQubm9ybWFsaXplQ29sb3IgPSBmdW5jdGlvbiAoY29sb3IsIGRlZmF1bHRDb2xvcnNJdGVyYXRvcikge1xuXG4gIGlmICghY29sb3IpIHtcbiAgICBjb2xvciA9IHtzb2xpZDogZGVmYXVsdENvbG9yc0l0ZXJhdG9yLm5leHQoKX07XG4gIH0gZWxzZSBpZiAodHlwZW9mIGNvbG9yID09PSAnc3RyaW5nJykge1xuICAgIGNvbG9yID0ge3NvbGlkOiBjb2xvcn07XG4gIH0gZWxzZSBpZiAoQXJyYXkuaXNBcnJheShjb2xvcikpIHtcbiAgICBjb2xvciA9IHtpbnRlcnBvbGF0ZTogY29sb3J9O1xuICB9IGVsc2UgaWYgKHR5cGVvZiBjb2xvciA9PT0gJ29iamVjdCcpIHtcbiAgICBpZiAoIWNvbG9yLnNvbGlkICYmICFjb2xvci5pbnRlcnBvbGF0ZSAmJiAhY29sb3IubGluZWFyR3JhZGllbnQgJiYgIWNvbG9yLnJhZGlhbEdyYWRpZW50KSB7XG4gICAgICBjb2xvci5zb2xpZCA9IGRlZmF1bHRDb2xvcnNJdGVyYXRvci5uZXh0KCk7XG4gICAgfVxuICB9XG5cbiAgLy8gVmFsaWRhdGUgaW50ZXJwb2xhdGUgc3ludGF4XG4gIGlmIChjb2xvci5pbnRlcnBvbGF0ZSkge1xuICAgIGlmIChjb2xvci5pbnRlcnBvbGF0ZS5sZW5ndGggIT09IDIpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcignaW50ZXJwb2xhdGUgYXJyYXkgc2hvdWxkIGNvbnRhaW4gdHdvIGNvbG9ycycpO1xuICAgIH1cbiAgfVxuXG4gIC8vIFZhbGlkYXRlIGdyYWRpZW50IHN5bnRheFxuICBpZiAoY29sb3IubGluZWFyR3JhZGllbnQgfHwgY29sb3IucmFkaWFsR3JhZGllbnQpIHtcbiAgICBpZiAoIWNvbG9yLnN0b3BzIHx8ICFBcnJheS5pc0FycmF5KGNvbG9yLnN0b3BzKSB8fCBjb2xvci5zdG9wcy5sZW5ndGggIT09IDIpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcignZ3JhZGllbnQgc3ludGF4IGlzIG1hbGZvcm1lZCcpO1xuICAgIH1cbiAgfVxuXG4gIC8vIFNldCBiYWNrZ3JvdW5kIHdoZW4gaXMgbm90IHByb3ZpZGVkXG4gIGlmICghY29sb3IuYmFja2dyb3VuZCkge1xuICAgIGlmIChjb2xvci5zb2xpZCkge1xuICAgICAgY29sb3IuYmFja2dyb3VuZCA9IGNvbG9yLnNvbGlkO1xuICAgIH0gZWxzZSBpZiAoY29sb3IuaW50ZXJwb2xhdGUpIHtcbiAgICAgIGNvbG9yLmJhY2tncm91bmQgPSBjb2xvci5pbnRlcnBvbGF0ZVswXTtcbiAgICB9IGVsc2UgaWYgKGNvbG9yLmxpbmVhckdyYWRpZW50IHx8IGNvbG9yLnJhZGlhbEdyYWRpZW50KSB7XG4gICAgICBjb2xvci5iYWNrZ3JvdW5kID0gY29sb3Iuc3RvcHNbMF1bJ3N0b3AtY29sb3InXTtcbiAgICB9XG4gIH1cblxuICByZXR1cm4gY29sb3I7XG5cbn07XG5cblxuLyoqXG4gKiBOb3JtYWxpemUgZGlmZmVyZW50IG5vdGF0aW9ucyBvZiBjZW50ZXIgcHJvcGVydHlcbiAqXG4gKiBAcGFyYW0ge1N0cmluZ3xBcnJheXxGdW5jdGlvbnxPYmplY3R9IGNlbnRlclxuICogQGV4YW1wbGUgJ2ZvbyBiYXInXG4gKiBAZXhhbXBsZSB7IGNvbnRlbnQ6ICdmb28gYmFyJywgeDogMTAsIHk6IDQgfVxuICogQGV4YW1wbGUgZnVuY3Rpb24odmFsdWUsIGluZGV4LCBpdGVtKSB7fVxuICogQGV4YW1wbGUgWydmb28gYmFyJywgZnVuY3Rpb24odmFsdWUsIGluZGV4LCBpdGVtKSB7fV1cbiAqL1xuUmFkaWFsUHJvZ3Jlc3NDaGFydC5ub3JtYWxpemVDZW50ZXIgPSBmdW5jdGlvbiAoY2VudGVyKSB7XG4gIGlmICghY2VudGVyKSByZXR1cm4gbnVsbDtcblxuICAvLyBDb252ZXJ0IHRvIG9iamVjdCBub3RhdGlvblxuICBpZiAoY2VudGVyLmNvbnN0cnVjdG9yICE9PSBPYmplY3QpIHtcbiAgICBjZW50ZXIgPSB7Y29udGVudDogY2VudGVyfTtcbiAgfVxuXG4gIC8vIERlZmF1bHRzXG4gIGNlbnRlci5jb250ZW50ID0gY2VudGVyLmNvbnRlbnQgfHwgW107XG4gIGNlbnRlci54ID0gY2VudGVyLnggfHwgMDtcbiAgY2VudGVyLnkgPSBjZW50ZXIueSB8fCAwO1xuXG4gIC8vIENvbnZlcnQgY29udGVudCB0byBhcnJheSBub3RhdGlvblxuICBpZiAoIUFycmF5LmlzQXJyYXkoY2VudGVyLmNvbnRlbnQpKSB7XG4gICAgY2VudGVyLmNvbnRlbnQgPSBbY2VudGVyLmNvbnRlbnRdO1xuICB9XG5cbiAgcmV0dXJuIGNlbnRlcjtcbn07XG5cbi8vIExpbmVhciBvciBSYWRpYWwgR3JhZGllbnQgaW50ZXJuYWwgb2JqZWN0XG5SYWRpYWxQcm9ncmVzc0NoYXJ0LkdyYWRpZW50ID0gKGZ1bmN0aW9uICgpIHtcbiAgZnVuY3Rpb24gR3JhZGllbnQoKSB7XG4gIH1cblxuICBHcmFkaWVudC50b1NWR0VsZW1lbnQgPSBmdW5jdGlvbiAoaWQsIG9wdGlvbnMpIHtcbiAgICB2YXIgZ3JhZGllbnRUeXBlID0gb3B0aW9ucy5saW5lYXJHcmFkaWVudCA/ICdsaW5lYXJHcmFkaWVudCcgOiAncmFkaWFsR3JhZGllbnQnO1xuICAgIHZhciBncmFkaWVudCA9IGQzLnNlbGVjdChkb2N1bWVudC5jcmVhdGVFbGVtZW50TlMoZDMubnMucHJlZml4LnN2ZywgZ3JhZGllbnRUeXBlKSlcbiAgICAgIC5hdHRyKG9wdGlvbnNbZ3JhZGllbnRUeXBlXSlcbiAgICAgIC5hdHRyKCdpZCcsIGlkKTtcblxuICAgIG9wdGlvbnMuc3RvcHMuZm9yRWFjaChmdW5jdGlvbiAoc3RvcEF0dHJzKSB7XG4gICAgICBncmFkaWVudC5hcHBlbmQoXCJzdmc6c3RvcFwiKS5hdHRyKHN0b3BBdHRycyk7XG4gICAgfSk7XG5cbiAgICB0aGlzLmJhY2tncm91bmQgPSBvcHRpb25zLnN0b3BzWzBdWydzdG9wLWNvbG9yJ107XG5cbiAgICByZXR1cm4gZ3JhZGllbnQubm9kZSgpO1xuICB9O1xuXG4gIHJldHVybiBHcmFkaWVudDtcbn0pKCk7XG5cbi8vIERlZmF1bHQgY29sb3JzIGl0ZXJhdG9yXG5SYWRpYWxQcm9ncmVzc0NoYXJ0LkNvbG9yc0l0ZXJhdG9yID0gKGZ1bmN0aW9uICgpIHtcblxuICBDb2xvcnNJdGVyYXRvci5ERUZBVUxUX0NPTE9SUyA9IFtcIiMxYWQ1ZGVcIiwgXCIjYTBmZjAzXCIsIFwiI2U5MGIzYVwiLCAnI2ZmOTUwMCcsICcjMDA3YWZmJywgJyNmZmNjMDAnLCAnIzU4NTZkNicsICcjOGU4ZTkzJ107XG5cbiAgZnVuY3Rpb24gQ29sb3JzSXRlcmF0b3IoKSB7XG4gICAgdGhpcy5pbmRleCA9IDA7XG4gIH1cblxuICBDb2xvcnNJdGVyYXRvci5wcm90b3R5cGUubmV4dCA9IGZ1bmN0aW9uICgpIHtcbiAgICBpZiAodGhpcy5pbmRleCA9PT0gQ29sb3JzSXRlcmF0b3IuREVGQVVMVF9DT0xPUlMubGVuZ3RoKSB7XG4gICAgICB0aGlzLmluZGV4ID0gMDtcbiAgICB9XG5cbiAgICByZXR1cm4gQ29sb3JzSXRlcmF0b3IuREVGQVVMVF9DT0xPUlNbdGhpcy5pbmRleCsrXTtcbiAgfTtcblxuICByZXR1cm4gQ29sb3JzSXRlcmF0b3I7XG59KSgpO1xuXG5cbi8vIEV4cG9ydCBSYWRpYWxQcm9ncmVzc0NoYXJ0IG9iamVjdFxuaWYgKHR5cGVvZiBtb2R1bGUgIT09IFwidW5kZWZpbmVkXCIpbW9kdWxlLmV4cG9ydHMgPSBSYWRpYWxQcm9ncmVzc0NoYXJ0OyJdfQ==
