/**
 * Matrix Rain Background Effect
 * Renders falling katakana/latin characters on a canvas behind all content.
 */
(function () {
  var canvas = document.getElementById('matrix-rain');
  if (!canvas) return;

  var ctx = canvas.getContext('2d');
  var columns = [];
  var fontSize = 14;
  var chars = 'アイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤユヨラリルレロワヲン0123456789ABCDEF';

  function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    var colCount = Math.floor(canvas.width / fontSize);
    // Preserve existing drop positions, add new ones if wider
    while (columns.length < colCount) {
      columns.push(Math.floor(Math.random() * -50));
    }
    columns.length = colCount;
  }

  function draw() {
    // Semi-transparent black overlay creates the fade trail
    ctx.fillStyle = 'rgba(0, 0, 0, 0.06)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.font = fontSize + 'px monospace';

    for (var i = 0; i < columns.length; i++) {
      var charIndex = Math.floor(Math.random() * chars.length);
      var x = i * fontSize;
      var y = columns[i] * fontSize;

      // Vary brightness — most chars are dim, a few are bright
      var brightness = Math.random();
      if (brightness > 0.95) {
        ctx.fillStyle = '#FFFFFF';
      } else if (brightness > 0.8) {
        ctx.fillStyle = 'rgba(0, 209, 255, 0.8)';
      } else {
        ctx.fillStyle = 'rgba(0, 209, 255, 0.15)';
      }

      ctx.fillText(chars[charIndex], x, y);

      // Reset drop to top randomly after going off screen
      if (y > canvas.height && Math.random() > 0.975) {
        columns[i] = 0;
      }

      columns[i]++;
    }
  }

  resize();
  window.addEventListener('resize', resize);
  setInterval(draw, 50);
})();
