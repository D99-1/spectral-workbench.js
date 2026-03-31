SpectralWorkbench.Image = Class.extend({

  init: function(_graph, options) {

    var image = this;

    image.options = options || {};
    image.options.selector = image.options.selector || 'div.swb-spectrum-img-container';

    // test if we're inside a require()
    // http://www.timetler.com/2012/10/13/environment-detection-in-javascript/
    var nodejs = typeof exports !== 'undefined' && this.exports !== exports;

    if (nodejs) {
      var Canvas = require('canvas');
      image.obj    = new Canvas.Image();
    } else {
      image.obj    = new Image();
    }


    if (!nodejs) {

      image.container = $(image.options.selector);
      image.el = image.container.find('img');

    }

    image.lineEl = false; // the line indicating the cross-section

    image.obj.onload = function() {

      image.graph = _graph;
      image.width = image.obj.width;
      image.height = image.obj.height;

      if (nodejs) {

        var Canvas = require('canvas'),
             Image = Canvas.Image,
             canvas = new Canvas(image.width, image.height);

        image.ctx = canvas.getContext('2d');

      } else {

        // We're in a browser; build a canvas element, but hide it.
        $('body').append('<canvas id="spectral-workbench-canvas" style="display:none;"></canvas>;');
        image.canvasEl = $('canvas#spectral-workbench-canvas:last');
        image.canvasEl.width(image.width);
        image.canvasEl.height(image.height);
        image.ctx = image.canvasEl[0].getContext("2d");

      }

      image.ctx.canvas.width = image.width;
      image.ctx.canvas.height = image.height;
      image.ctx.drawImage(image.obj, 0, 0, image.width, image.height);

      if (image.options.sample_row) image.setLine(image.options.sample_row);

      if (image.options.onLoad) image.options.onLoad(image); // since image loading is asynchronous

    }

    var src = image.options.url || image.el.attr('src');

    if (src) image.obj.src = src;
    else {

      // If there's no image, whether grabbed from the element
      // or supplied, just trigger onLoad callback already
      if (image.options.hasOwnProperty('onLoad')) image.options.onLoad(image);

    }

    /* ======================================
     * Returns a array of pixel brightnesses in [r,g,b,a] format, 
     * values from 0-255
     */
    image.getPoint = function(x,y) {

      return image.ctx.getImageData(x, y, 1, 1).data;

    }


    /* ======================================
     * Returns a nested array of pixels, each in the format of getPoint(), 
     * values from 0-255. Supports arbitrary lines if x1, y1, x2, y2 are provided.
     */
    image.getLine = function(x1, y1, x2, y2) {

      if (arguments.length === 1) {
        y1 = y2 = x1;
        x1 = 0;
        x2 = image.width;
      }

      var output = [];
      var dx = x2 - x1;
      var dy = y2 - y1;
      var distance = Math.sqrt(dx*dx + dy*dy);
      var steps = Math.round(distance);

      for (var i = 0; i < steps; i++) {
        var x = Math.round(x1 + (dx * i / steps));
        var y = Math.round(y1 + (dy * i / steps));
        // Ensure within bounds
        x = Math.max(0, Math.min(image.width - 1, x));
        y = Math.max(0, Math.min(image.height - 1, y));
        output.push(image.getPoint(x, y));
      }

      return output;

    }


    /* ======================================
     * Display a line on the image using an SVG overlay.
     */
    image.setupLine = function() {

      if (_graph && !image.svg) {

        image.el.before($('<div class="section-line-container"></div>'));
        image.lineContainerEl = image.container.find('.section-line-container');
        image.lineContainerEl.css('position', 'relative')
                             .css('width', '100%')
                             .css('height', 0);

        image.svg = d3.select(image.lineContainerEl[0])
          .append('svg:svg')
          .style('position', 'absolute')
          .style('top', 0)
          .style('left', 0)
          .style('width', '100%')
          .style('height', '100px')
          .style('pointer-events', 'none')
          .attr('class', 'sampling-line-overlay');

        image.lineEl = image.svg.append('svg:line')
          .attr('stroke', 'rgba(255,255,255,0.5)')
          .attr('stroke-width', 1);

        image.handle1 = image.svg.append('svg:circle')
          .attr('r', 5)
          .attr('fill', 'rgba(255,255,255,0.8)')
          .attr('cursor', 'move')
          .style('pointer-events', 'all')
          .style('display', 'none');

        image.handle2 = image.svg.append('svg:circle')
          .attr('r', 5)
          .attr('fill', 'rgba(255,255,255,0.8)')
          .attr('cursor', 'move')
          .style('pointer-events', 'all')
          .style('display', 'none');

      }

    }


    /* ======================================
     * Display a line on the image, from (x1, y1) to (x2, y2) in image pixels.
     * If only one argument is provided, it's treated as a horizontal row.
     */
    image.setLine = function(x1, y1, x2, y2) {

      if (!image.svg) image.setupLine();

      if (arguments.length === 1) {
        y1 = y2 = x1;
        x1 = 0;
        x2 = image.width;
      }

      image.coords = { x1: x1, y1: y1, x2: x2, y2: y2 };

      // convert to display scale
      var displayWidth = image.el.width();
      var displayHeight = image.el.height();

      var dx1 = (x1 / image.width) * displayWidth;
      var dy1 = (y1 / image.height) * displayHeight;
      var dx2 = (x2 / image.width) * displayWidth;
      var dy2 = (y2 / image.height) * displayHeight;

      image.lineEl
        .attr('x1', dx1)
        .attr('y1', dy1)
        .attr('x2', dx2)
        .attr('y2', dy2);

      image.handle1
        .attr('cx', dx1)
        .attr('cy', dy1)
        .style('display', 'block');

      image.handle2
        .attr('cx', dx2)
        .attr('cy', dy2)
        .style('display', 'block');

      return image.lineEl;

    }


    /* ======================================
     * Executes callback(x, y, e) when image is clicked
     * adjusted to actual pixels in original raw image
     */
    image.click = function(callback) {

      image.el.click(function(e){

        var x = Math.round((e.offsetX / image.el.width())  * image.width),
            y = Math.round((e.offsetY / image.el.height()) * image.height);

        callback(x, y, e);

      });

    }


    /* ======================================
     * Deletes click listeners
     */
    image.clickOff = function() {

      image.el.off('click');

    }


    /* ======================================
     * Resizes image elements; called in Graph.updateSize()
     */
    image.updateSize = function() {

      // OK, due to issue https://github.com/publiclab/spectral-workbench/issues/240, 
      // we are getting aggressively empirical here and adding "_graph.extraPadding" to fix things
      // but essentially it seems there's a difference between reported d3 chart display width and actual 
      // measurable DOM width, so we adjust the displayed image with extraPadding.
      image.container.width(_graph.width)
                            .height(100);

      if (!_graph.embed) image.container.css('margin-left',  _graph.margin.left);
      else               image.container.css('margin-left',  _graph.margin.left);
                         // .css('margin-right', _graph.margin.right); // margin not required on image, for some reason


      if (_graph.range && _graph.datum) {

        if (_graph.datum.isCalibrated()) {

          // amount to mask out of image if there's a range tag;
          // this is measured in nanometers:
          _graph.leftCrop =   _graph.extent[0] - _graph.datum.json.data.lines[0].wavelength;
          _graph.rightCrop = -_graph.extent[1] + _graph.datum.json.data.lines[_graph.datum.json.data.lines.length - 1].wavelength;
          // note, we must use extent here instead of range, as range may extend beyond limit of data;
          // although we could alternately set the chart extent to include empty space

          _graph.pxPerNm = (_graph.width) / (_graph.extent[1] - _graph.extent[0]);
         
          _graph.leftCrop  *= _graph.pxPerNm;
          _graph.rightCrop *= _graph.pxPerNm;

        } else {

          // for uncalibrated, we still allow range, in case someone's doing purely comparative work:
          _graph.leftCrop =   _graph.extent[0] - _graph.datum.json.data.lines[0].pixel;
          _graph.rightCrop = -_graph.extent[1] + _graph.datum.json.data.lines[_graph.datum.json.data.lines.length - 1].pixel;
         
          _graph.pxPerNm = 1; // a lie, but as there are no nanometers in an uncalibrated spectrum, i guess it's OK.

        }

        image.el.width(_graph.width + _graph.leftCrop + _graph.rightCrop) // left and rightCrop are masked out range
                       .css('max-width', 'none')
                       .css('margin-left', -_graph.leftCrop);

      } else {

        image.el.width(_graph.width)
                       .height(100)
                       .css('max-width', 'none')
                       .css('margin-left', 0);

      }

      if (image.svg) {

        image.svg.attr('width', image.el.width())
                 .css('margin-left', image.el.css('margin-left'));

        if (image.coords) {
          image.setLine(image.coords.x1, image.coords.y1, image.coords.x2, image.coords.y2);
        }

      }

    }


  }

});
