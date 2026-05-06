function wavelengthToRGB(wavelength) {
  let r, g, b, factor;
  if (wavelength >= 380 && wavelength < 440) { r = -(wavelength - 440) / (440 - 380); g = 0.0; b = 1.0; }
  else if (wavelength >= 440 && wavelength < 490) { r = 0.0; g = (wavelength - 440) / (490 - 440); b = 1.0; }
  else if (wavelength >= 490 && wavelength < 510) { r = 0.0; g = 1.0; b = -(wavelength - 510) / (510 - 490); }
  else if (wavelength >= 510 && wavelength < 580) { r = (wavelength - 510) / (580 - 510); g = 1.0; b = 0.0; }
  else if (wavelength >= 580 && wavelength < 645) { r = 1.0; g = -(wavelength - 645) / (645 - 580); b = 0.0; }
  else if (wavelength >= 645 && wavelength <= 780) { r = 1.0; g = 0.0; b = 0.0; }
  else { r = 0.0; g = 0.0; b = 0.0; }
  if (wavelength >= 380 && wavelength < 420) factor = 0.3 + 0.7 * (wavelength - 380) / (420 - 380);
  else if (wavelength >= 420 && wavelength <= 700) factor = 1.0;
  else if (wavelength > 700 && wavelength <= 780) factor = 0.3 + 0.7 * (780 - wavelength) / (780 - 700);
  else factor = 0.0;
  const gamma = 0.8, intensityMax = 255;
  const adjust = (c, f) => Math.round(intensityMax * Math.pow(c * f, gamma));
  return { r: adjust(r, factor), g: adjust(g, factor), b: adjust(b, factor) };
}

function updateColorBar(canvasId, pixels, extent, calibratedLines) {
  let canvas = document.getElementById(canvasId);
  if (!canvas) return;
  let displayWidth = canvas.clientWidth, displayHeight = canvas.clientHeight || 15;
  if (canvas.width !== displayWidth || canvas.height !== displayHeight) { canvas.width = displayWidth; canvas.height = displayHeight; }
  let container = canvas.parentNode;
  let label = container.querySelector('.color-bar-label') || document.createElement('div');
  label.className = 'color-bar-label'; label.innerText = "";
  if (!label.parentNode) container.appendChild(label);
  let ctx = canvas.getContext('2d'), w = canvas.width, h = canvas.height;
  ctx.clearRect(0, 0, w, h);

  if (calibratedLines) {
    // calibratedLines is typically spec.average which is an array of {x, y} where y is 0-1
    let visibleLines = extent ? calibratedLines.filter(l => l.x >= extent[0] && l.x <= extent[1]) : calibratedLines;
    if (visibleLines.length === 0) return;
    let step = w / visibleLines.length;
    visibleLines.forEach((line, i) => {
      let x = i * step;
      if (line.x < 380 || line.x > 780) { ctx.fillStyle = "white"; }
      else {
        let baseColor = wavelengthToRGB(line.x);
        let intensity = line.y;
        ctx.fillStyle = `rgb(${Math.round(baseColor.r * intensity)},${Math.round(baseColor.g * intensity)},${Math.round(baseColor.b * intensity)})`;
      }
      ctx.fillRect(x, 0, step + 1, h);
    });
    return;
  }

  if (!pixels || pixels.length === 0) return;
  let startIdx = extent ? Math.max(0, Math.floor(extent[0])) : 0;
  let endIdx = extent ? Math.min(pixels.length - 1, Math.ceil(extent[1])) : pixels.length - 1;
  let visibleCount = endIdx - startIdx + 1, step = w / visibleCount;
  for (let i = 0; i < visibleCount; i++) {
    let p = pixels[startIdx + i];
    ctx.fillStyle = `rgb(${Math.round(p.r)},${Math.round(p.g)},${Math.round(p.b)})`;
    ctx.fillRect(i * step, 0, step + 1, h);
  }
}

function syncColorBar(graph, canvasId, pixels, calibratedLines) {
  if (!graph || !graph.chart) return;
  let update = () => { let extent = graph.chart.xAxis.scale().domain(); updateColorBar(canvasId, pixels, extent, calibratedLines); };
  if (graph.chart.focus && graph.chart.focus.brush) graph.chart.focus.dispatch.on('brush', update);
  graph.chart.dispatch.on('renderEnd', update);
  update();
}

function createRGBSpectrum(pixels) {
  return new SpectralWorkbench.Spectrum({ data: { lines: pixels.map((p, i) => ({ pixel: i, r: p.r, g: p.g, b: p.b, average: (p.r+p.g+p.b)/3 })) } });
}

function setupDraggableLine(canvas, img, onUpdate, existingPoints) {
  let points = existingPoints || { a: null, b: null };
  let container = d3.select(canvas.parentNode);
  container.selectAll('.svg-overlay').remove();
  let svg = container.append('svg').attr('class', 'svg-overlay')
      .attr('viewBox', `0 0 ${canvas.width} ${canvas.height}`)
      .attr('preserveAspectRatio', 'xMidYMid meet');
  let line = svg.append('line').attr('stroke', '#ffcc00').attr('stroke-width', 2).style('display', 'none');
  let handleA = svg.append('circle').attr('r', 6).attr('fill', '#ffcc00').attr('stroke', '#ffaa33').style('display', 'none');
  let handleB = svg.append('circle').attr('r', 6).attr('fill', '#ffcc00').attr('stroke', '#ffaa33').style('display', 'none');

  let offCanvas = document.createElement('canvas'); offCanvas.width = img.width; offCanvas.height = img.height;
  let offCtx = offCanvas.getContext('2d'); offCtx.drawImage(img, 0, 0);
  let swbImg = new SpectralWorkbench.Image(null, { url: img.src }); swbImg.obj = img; swbImg.width = img.width; swbImg.height = img.height; swbImg.ctx = offCtx;

  function updateUI() {
    let rect = canvas.getBoundingClientRect();
    if (!rect.width) return;
    let scale = canvas.width / rect.width;
    let baseSize = 8;
    if (points.a) handleA.attr({cx: points.a.x, cy: points.a.y, r: baseSize * scale}).style({'display': 'block', 'stroke-width': (baseSize/4) * scale});
    if (points.b) {
      handleB.attr({cx: points.b.x, cy: points.b.y, r: baseSize * scale}).style({'display': 'block', 'stroke-width': (baseSize/4) * scale});
      line.attr({x1: points.a.x, y1: points.a.y, x2: points.b.x, y2: points.b.y}).style({'display': 'block', 'stroke-width': (baseSize/4) * scale});
      let scaleX = img.width / canvas.width, scaleY = img.height / canvas.height;
      let raw = swbImg.getLine(points.a.x * scaleX, points.a.y * scaleY, points.b.x * scaleX, points.b.y * scaleY);
      onUpdate(raw.map(p => ({ r: p[0], g: p[1], b: p[2] })));
    }
  }
  let drag = d3.behavior.drag().on('drag', function() {
    let isA = d3.select(this).node() === handleA.node();
    let target = isA ? points.a : points.b;
    target.x = Math.max(0, Math.min(canvas.width, d3.event.x)); target.y = Math.max(0, Math.min(canvas.height, d3.event.y));
    updateUI();
  });
  handleA.call(drag); handleB.call(drag);
  svg.on('click', function() {
    if (points.a && points.b) return;
    let m = d3.mouse(this);
    if (!points.a) points.a = { x: m[0], y: m[1] }; else if (!points.b) points.b = { x: m[0], y: m[1] };
    updateUI();
  });
  updateUI();
  $(window).off('resize.swb').on('resize.swb', updateUI);
}

function setupDraggableLine3Point(canvas, img, endpoints, onUpdate, relativeMode, errorId) {
  let container = d3.select(canvas.parentNode);
  container.selectAll('.svg-overlay').remove();
  let svg = container.append('svg').attr('class', 'svg-overlay')
      .attr('viewBox', `0 0 ${canvas.width} ${canvas.height}`)
      .attr('preserveAspectRatio', 'xMidYMid meet');

  let line = svg.append('line').attr('stroke', '#ffcc00').attr('stroke-width', 2).style('display', 'none');
  let stalk = svg.append('line').attr('class', 'rot-stalk').style('display', 'none');
  let handleA = svg.append('circle').attr({r: 6, fill: '#ffcc00', stroke: '#ffaa33'}).style('display', 'none');
  let handleB = svg.append('circle').attr({r: 6, fill: '#ffcc00', stroke: '#ffaa33'}).style('display', 'none');

  let handleRef = svg.append('g').attr('class', 'handle').style('display', 'none');
  handleRef.append('line').attr({x1: -8, y1: 0, x2: 8, y2: 0, stroke: 'blue', 'stroke-width': 3});
  handleRef.append('line').attr({x1: 0, y1: -8, x2: 0, y2: 8, stroke: 'blue', 'stroke-width': 3});
  handleRef.append('circle').attr({r: 10, fill: 'transparent'});

  let handleRot = svg.append('g').attr('class', 'rot-handle').style('display', 'none');
  handleRot.append('circle').attr({r: 5});

  function updateUI() {
    let rect = canvas.getBoundingClientRect();
    if (!rect.width) return;
    let scale = canvas.width / rect.width;
    let baseSize = 8;

    if (endpoints.a) {
      handleA.attr({cx: endpoints.a.x, cy: endpoints.a.y, r: baseSize * scale})
             .style({'display': 'block', 'stroke-width': (baseSize/4) * scale});
    }
    if (endpoints.b) {
      handleB.attr({cx: endpoints.b.x, cy: endpoints.b.y, r: baseSize * scale})
             .style({'display': 'block', 'stroke-width': (baseSize/4) * scale});
      line.attr({x1: endpoints.a.x, y1: endpoints.a.y, x2: endpoints.b.x, y2: endpoints.b.y})
          .style({'display': 'block', 'stroke-width': (baseSize/4) * scale});
    }
    if (endpoints.ref) {
      handleRef.attr('transform', `translate(${endpoints.ref.x},${endpoints.ref.y}) scale(${scale * (baseSize/6)})`).style('display', 'block');
      handleRef.selectAll('line').style('stroke-width', 3);

      let rotX = endpoints.ref.x;
      let rotY = endpoints.ref.y - 40 * scale;
      handleRot.attr('transform', `translate(${rotX},${rotY}) scale(${scale * (baseSize/6)})`).style('display', 'block');
      stalk.attr({x1: endpoints.ref.x, y1: endpoints.ref.y, x2: rotX, y2: rotY})
           .style({'display': 'block', 'stroke-width': (baseSize/8) * scale});
    }

    let outOfBounds = false;
    [endpoints.a, endpoints.b, endpoints.ref].forEach(p => {
      if (p && (p.x < 0 || p.x > canvas.width || p.y < 0 || p.y > canvas.height)) outOfBounds = true;
    });

    if (errorId) $(`#${errorId}`).toggle(outOfBounds);
    onUpdate(endpoints, outOfBounds);
  }

  let startAngles = null;
  let drag = d3.behavior.drag()
    .on('dragstart', function() {
      if (relativeMode && d3.select(this).classed('rot-handle')) {
        let mouse = d3.mouse(svg.node());
        let startAngle = Math.atan2(mouse[1] - endpoints.ref.y, mouse[0] - endpoints.ref.x);
        startAngles = {
          mouse: startAngle,
          a: endpoints.a ? Math.atan2(endpoints.a.y - endpoints.ref.y, endpoints.a.x - endpoints.ref.x) : 0,
          b: endpoints.b ? Math.atan2(endpoints.b.y - endpoints.ref.y, endpoints.b.x - endpoints.ref.x) : 0,
          distA: endpoints.a ? Math.sqrt(Math.pow(endpoints.a.x - endpoints.ref.x, 2) + Math.pow(endpoints.a.y - endpoints.ref.y, 2)) : 0,
          distB: endpoints.b ? Math.sqrt(Math.pow(endpoints.b.x - endpoints.ref.x, 2) + Math.pow(endpoints.b.y - endpoints.ref.y, 2)) : 0
        };
      }
    })
    .on('drag', function() {
      let node = d3.select(this).node();
      if (relativeMode) {
        if (d3.select(this).classed('rot-handle')) {
          let mouse = d3.mouse(svg.node());
          let currentAngle = Math.atan2(mouse[1] - endpoints.ref.y, mouse[0] - endpoints.ref.x);
          let delta = currentAngle - startAngles.mouse;

          if (endpoints.a) {
            endpoints.a.x = endpoints.ref.x + startAngles.distA * Math.cos(startAngles.a + delta);
            endpoints.a.y = endpoints.ref.y + startAngles.distA * Math.sin(startAngles.a + delta);
          }
          if (endpoints.b) {
            endpoints.b.x = endpoints.ref.x + startAngles.distB * Math.cos(startAngles.b + delta);
            endpoints.b.y = endpoints.ref.y + startAngles.distB * Math.sin(startAngles.b + delta);
          }
        } else {
          let dx = d3.event.dx, dy = d3.event.dy;
          if (endpoints.a) { endpoints.a.x += dx; endpoints.a.y += dy; }
          if (endpoints.b) { endpoints.b.x += dx; endpoints.b.y += dy; }
          if (endpoints.ref) { endpoints.ref.x += dx; endpoints.ref.y += dy; }
        }
      } else {
        if (d3.select(this).classed('handle')) {
          endpoints.ref.x = d3.event.x; endpoints.ref.y = d3.event.y;
        } else {
          let isA = d3.select(this).node() === handleA.node();
          let target = isA ? endpoints.a : endpoints.b;
          target.x = d3.event.x; target.y = d3.event.y;
        }
      }
      updateUI();
    });

  handleRef.call(drag);
  handleA.call(drag);
  handleB.call(drag);
  handleRot.call(drag);

  svg.on('click', function() {
    if (relativeMode) return;
    if (endpoints.a && endpoints.b && endpoints.ref) return;

    let m = d3.mouse(this);
    let p = { x: m[0], y: m[1] };

    if (!endpoints.a) endpoints.a = p;
    else if (!endpoints.b) endpoints.b = p;
    else if (!endpoints.ref) endpoints.ref = p;

    updateUI();
  });

  updateUI();
  $(window).off('resize.swb').on('resize.swb', updateUI);
}
