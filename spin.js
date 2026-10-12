/* HERO JAR ONLY: click -> smooth, glass-like 360° turn (front -> back label -> front).
   The jar is wrapped onto a cylinder in WebGL so the label curves around the glass like a real jar. */
(function () {
  var img = document.querySelector(".mh-hero-product img");
  if (!img) return;

  var FRONT = "images/madhuravana-front-bottle.png";
  var BACK = "images/madhuravana-back-bottle.png";
  var DURATION = 3600; // ms - slow and elegant

  var texFront = new Image(), texBack = new Image(), ready = 0, busy = false;
  texFront.onload = texBack.onload = function () { ready++; };
  texFront.src = FRONT; texBack.src = BACK;

  img.style.cursor = "pointer";
  img.setAttribute("title", "Click to turn the jar");
  img.setAttribute("tabindex", "0");
  img.setAttribute("role", "button");
  img.style.webkitTapHighlightColor = "transparent";

  function easeInOut(t) { return t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; }

  /* per-row silhouette (centre + half width) measured from the PNG alpha */
  function measureRows(image) {
    var w = image.naturalWidth, h = image.naturalHeight;
    var c = document.createElement("canvas"); c.width = w; c.height = h;
    var x = c.getContext("2d"); x.drawImage(image, 0, 0);
    var d = x.getImageData(0, 0, w, h).data, cen = new Float32Array(h), rad = new Float32Array(h);
    for (var y = 0; y < h; y++) {
      var l = -1, r = -1;
      for (var i = 0; i < w; i++) { if (d[(y * w + i) * 4 + 3] > 150) { l = i; break; } }
      for (var j = w - 1; j >= 0; j--) { if (d[(y * w + j) * 4 + 3] > 150) { r = j; break; } }
      if (l < 0 || r - l < 6) { cen[y] = w / 2; rad[y] = 0; } else { cen[y] = (l + r + 1) / 2; rad[y] = Math.max(0, (r - l + 1) / 2 - 1.5); }
    }
    function smooth(a) {
      var o = new Float32Array(h);
      for (var y = 0; y < h; y++) {
        var s = 0, n = 0;
        for (var k = -3; k <= 3; k++) { var yy = y + k; if (yy >= 0 && yy < h && rad[yy] > 0) { s += a[yy]; n++; } }
        o[y] = n ? s / n : a[y];
      }
      return o;
    }
    var sc = smooth(cen), sr = smooth(rad);
    for (var y2 = 0; y2 < h; y2++) if (rad[y2] === 0) sr[y2] = 0;
    var buf = new Uint8Array(h * 4);
    for (var q = 0; q < h; q++) {
      var cv = Math.round(sc[q] / w * 65535), rv = Math.round(sr[q] / w * 65535);
      buf[q * 4] = cv >> 8; buf[q * 4 + 1] = cv & 255; buf[q * 4 + 2] = rv >> 8; buf[q * 4 + 3] = rv & 255;
    }
    return buf;
  }

  var VS = "attribute vec2 p;varying vec2 uv;void main(){uv=vec2(p.x*.5+.5,.5-p.y*.5);gl_Position=vec4(p,0.,1.);}";
  var FS = [
    "precision highp float;varying vec2 uv;",
    "uniform sampler2D tf,tb,rows;uniform float phi;uniform float k;",
    "float dec(vec2 v){return (v.x*255.*256.+v.y*255.)/65535.;}",
    "void main(){",
    " vec4 rw=texture2D(rows,vec2(.5,uv.y));",
    " float c=dec(rw.xy),r=dec(rw.zw);",
    " if(r<=0.){gl_FragColor=vec4(0.);return;}",
    " float x=(uv.x-c)/r;",
    " float edge=1.-smoothstep(.985,1.,abs(x));",
    " if(edge<=0.){gl_FragColor=vec4(0.);return;}",
    " float th=asin(clamp(x,-1.,1.));",
    " float a=th+phi;",
    " a=mod(a+3.14159265,6.2831853)-3.14159265;",
    " vec3 col;",
    " if(cos(a)>=0.){col=texture2D(tf,vec2(c+r*sin(a),uv.y)).rgb;}",
    " else{col=texture2D(tb,vec2(c-r*sin(a),uv.y)).rgb;}",
    " float rim=mix(1.,.80+.20*cos(th),k);",
    " float glint=exp(-pow((x+.38)/.07,2.))*.16*k+exp(-pow((x-.55)/.05,2.))*.07*k;",
    " col=col*rim+vec3(glint);",
    " gl_FragColor=vec4(col*edge,edge);",
    "}"
  ].join("\n");

  function makeTex(gl, source, unit) {
    var t = gl.createTexture();
    gl.activeTexture(gl.TEXTURE0 + unit); gl.bindTexture(gl.TEXTURE_2D, t);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    return t;
  }
  function sh(gl, type, src) { var s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); return s; }

  var rowsBuf = null;

  function spin() {
    if (busy || ready < 2) return;
    var cw = img.clientWidth, ch = img.clientHeight;
    if (!cw || !ch) return;
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var canvas = document.createElement("canvas");
    canvas.width = Math.round(cw * dpr); canvas.height = Math.round(ch * dpr);
    var gl = canvas.getContext("webgl", { premultipliedAlpha: true, alpha: true, antialias: true });
    if (!gl) { return; } /* no WebGL: leave the jar untouched, never break the page */
    busy = true;

    if (!rowsBuf) rowsBuf = measureRows(texFront);
    var prog = gl.createProgram();
    gl.attachShader(prog, sh(gl, gl.VERTEX_SHADER, VS)); gl.attachShader(prog, sh(gl, gl.FRAGMENT_SHADER, FS));
    gl.linkProgram(prog); gl.useProgram(prog);
    var vb = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, vb);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    var loc = gl.getAttribLocation(prog, "p"); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    makeTex(gl, texFront, 0); makeTex(gl, texBack, 1);
    var rt = gl.createTexture(); gl.activeTexture(gl.TEXTURE2); gl.bindTexture(gl.TEXTURE_2D, rt);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, rowsBuf.length / 4, 0, gl.RGBA, gl.UNSIGNED_BYTE, rowsBuf);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.uniform1i(gl.getUniformLocation(prog, "tf"), 0); gl.uniform1i(gl.getUniformLocation(prog, "tb"), 1); gl.uniform1i(gl.getUniformLocation(prog, "rows"), 2);
    var uPhi = gl.getUniformLocation(prog, "phi"), uK = gl.getUniformLocation(prog, "k");
    gl.viewport(0, 0, canvas.width, canvas.height); gl.clearColor(0, 0, 0, 0);

    var cs = window.getComputedStyle(img);
    canvas.style.cssText = "position:relative;z-index:2;width:" + cw + "px;height:" + ch + "px;display:block;filter:" + cs.filter + ";pointer-events:none;";
    function draw(phi) {
      var k = Math.pow(Math.sin(phi / 2), 2);
      gl.clear(gl.COLOR_BUFFER_BIT); gl.uniform1f(uPhi, phi); gl.uniform1f(uK, k); gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    }
    draw(0);
    img.parentNode.insertBefore(canvas, img); img.style.display = "none";

    var start = null;
    function frame(ts) {
      if (start === null) start = ts;
      var t = Math.min((ts - start) / DURATION, 1);
      draw(easeInOut(t) * Math.PI * 2);
      if (t < 1) requestAnimationFrame(frame);
      else {
        img.style.display = ""; if (canvas.parentNode) canvas.parentNode.removeChild(canvas);
        var ext = gl.getExtension("WEBGL_lose_context"); if (ext) ext.loseContext();
        busy = false;
      }
    }
    requestAnimationFrame(frame);
  }

  img.addEventListener("click", spin);
  img.addEventListener("keydown", function (e) { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); spin(); } });
})();
