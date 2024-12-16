const URL = './my_model/';
let model, webcam, ctx, maxPredictions;
let score = 0;

const state = {
  activeLabel: null,
  startTime: null,
  threshold: 0.8,
  duration: 3000,
};

$(document).ready(function () {
  async function init() {
    try {
      const modelURL = URL + 'model.json';
      const metadataURL = URL + 'metadata.json';

      model = await tmPose.load(modelURL, metadataURL);
      console.log('모델 로드 성공');
      maxPredictions = model.getTotalClasses();

      classLabels = model.getClassLabels();
      console.log('클래스 이름:', classLabels);

      const flip = true;
      webcam = new tmPose.Webcam(window.innerWidth, window.innerHeight, flip);
      await webcam.setup();
      await webcam.play();
      console.log('웹캠 로드 성공');

      const canvas = $('#canvas')[0];
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      ctx = canvas.getContext('2d');

      requestAnimationFrame(loop);
    } catch (err) {
      console.error('초기화 실패:', err);
    }
  }

  async function loop() {
    webcam.update();
    await predict();
    requestAnimationFrame(loop);
  }

  async function predict() {
    if (!webcam || !model) return;

    const { pose, posenetOutput } = await model.estimatePose(webcam.canvas);
    const predictions = await model.predict(posenetOutput);

    processPredictions(predictions);

    drawPose(pose);
  }

  function processPredictions(predictions) {
    const currentTime = Date.now();

    const excludedClassIndex = 2;
    const excludedClassName = predictions[excludedClassIndex]?.className;
    const topPrediction = predictions.reduce((max, pred) =>
      pred.probability > max.probability ? pred : max
    );

    if (topPrediction.probability > state.threshold) {
      if (state.activeLabel === topPrediction.className) {
        if (
          currentTime - state.startTime >= state.duration &&
          topPrediction.className !== excludedClassName
        ) {
          console.log(`3초 동안 유지된 클래스: ${state.activeLabel}`);

          const matchedBubble = bubbles.find(
            (bubble) => bubble.targetClass === topPrediction.className
          );
          if (matchedBubble) {
            scoreBubble(matchedBubble.id);
            updateScore();
          }

          resetState();
        }
      } else {
        state.activeLabel = topPrediction.className;
        state.startTime = currentTime;
      }
    } else {
      resetState();
    }
  }

  function resetState() {
    state.activeLabel = null;
    state.startTime = null;
  }

  function updateScore() {
    if (score >= 5) {
      console.log('최대 점수에 도달했습니다.');
      return;
    }

    score += 1;
    console.log(`Score: ${score}`);
    const scoreElement = $('.score-box .bubble-score').eq(score - 1);
    if (scoreElement.length > 0) {
      scoreElement.addClass('active');
      console.log(`Score bubble activated: ${score}`);
    }

    const colorBar = $('#process-bar .color-bar');
    const currentWidth = parseInt(colorBar.css('width')) || 0;
    const maxWidth = window.innerWidth;
    const increase = maxWidth / 5;
    const newWidth = Math.min(currentWidth + increase, maxWidth);

    colorBar.css('width', `${newWidth}px`);
    console.log(`Color bar updated: ${newWidth}px`);
  }

  function drawPose(pose) {
    if (!webcam.canvas) return;

    ctx.drawImage(webcam.canvas, 0, 0);

    if (pose) {
      const minPartConfidence = 0.5;
      tmPose.drawKeypoints(pose.keypoints, minPartConfidence, ctx);
      tmPose.drawSkeleton(pose.keypoints, minPartConfidence, ctx);
    }
  }

  let bubbles = [];
  const bubbleDuration = 8000;

  function createBubble() {
    const bubbleContainer = $('#bubble-container');
    const bubbleId = `bubble-${Date.now()}`;

    const isLeft = Math.random() < 0.5;
    const leftPosition = isLeft
      ? Math.random() * 10 + 20
      : Math.random() * 10 + 80;
    const topPosition = Math.random() * 10 + 60;

    const targetClass = isLeft ? classLabels[0] : classLabels[1];
    console.log(`비눗방울 생성: ${bubbleId}, 연결된 클래스: ${targetClass}`);

    const bubble = $(
      `<div class="bubble" id="${bubbleId}" data-target="${targetClass}"></div>`
    );
    bubble.css({
      left: `${leftPosition}%`,
      top: `${topPosition}%`,
    });
    bubbleContainer.append(bubble);

    bubbles.push({ id: bubbleId, targetClass });
    console.log(`Bubble created:`, { id: bubbleId, targetClass });

    setTimeout(() => {
      removeBubble(bubbleId);
    }, bubbleDuration);
  }

  function scoreBubble(bubbleId) {
    const bubbleElement = $(`#${bubbleId}`);

    bubbleElement.css({
      backgroundImage: 'url(./image/버블터질때.gif)',
      backgroundSize: 'cover',
      backgroundRepeat: 'no-repeat',
      backgroundPosition: 'center',
    });

    const overlay = $('#overlay');
    overlay.css('background-color', 'rgba(220, 210, 255, 0.3)');
    overlay.show();
    overlay
      .fadeIn(100)
      .delay(200)
      .fadeOut(500, () => {
        overlay.hide();
      });

    setTimeout(() => {
      bubbleElement.remove();
      bubbles = bubbles.filter((bubble) => bubble.id !== bubbleId);
    }, 500);
  }

  function removeBubble(bubbleId) {
    const bubbleElement = $(`#${bubbleId}`);

    bubbleElement.remove();
  }

  function getRandomClass() {
    if (classLabels.length === 0) {
      console.error('클래스 이름이 로드되지 않았습니다.');
      return null;
    }

    const validClasses = classLabels.filter((label, index) => index !== 2);
    const randomClass =
      validClasses[Math.floor(Math.random() * validClasses.length)];
    console.log('랜덤으로 선택된 클래스:', randomClass);
    return randomClass;
  }

  function startGame() {
    const bubbleInterval = setInterval(() => {
      if (score >= 5) {
        console.log('최대 점수에 도달했습니다. 비눗방울 생성을 중단합니다.');
        clearInterval(bubbleInterval);
        endGame();
        return;
      }

      if (bubbles.length < 2) {
        createBubble();
      }
    }, 8000);
  }

  function endGame() {
    if (score >= 5) {
      $('#last-modal')
        .css({ opacity: '0', zIndex: '5' })
        .animate({ opacity: 1 }, 600, function () {
          $(this).css('opacity', '1');
        });
      console.log('z-index 늘어났음');
    }
  }

  $('.modalBT').on('click', function () {
    $('#start-modal')
      .css('opacity', '1')
      .animate({ opacity: 0 }, 600, function () {
        $(this).css('opacity', '0');

        startGame();
      });

    setTimeout(function () {
      $('#tipbox')
        .css('opacity', '1')
        .animate({ opacity: 0 }, 600, function () {
          $(this).css('opacity', '0');
        });

      $('#tipBT')
        .css('opacity', '0')
        .animate({ opacity: 1 }, 600, function () {
          $(this).css('opacity', '1');
        });
    }, 5000);

    setTimeout(function () {
      $('#silhouette-container')
        .css('opacity', '0.5')
        .animate({ opacity: 0 }, 600, function () {
          $(this).css('opacity', '0');
        });
    }, 5000);
  });

  $('#tipBT').on('click', function () {
    if ($('#tipbox').css('opacity') === '0') {
      $('#tipbox')
        .css('opacity', '0')
        .animate({ opacity: 1 }, 600, function () {
          $(this).css('opacity', '1');
        });

      $('#tipBT')
        .css(`opacity`, `1`)
        .animate({ opacity: 0 }, 600, function () {
          $(this).css('opacity', '0');
        });

      setTimeout(function () {
        $('#tipbox')
          .css(`opacity`, `1`)
          .animate({ opacity: 0 }, 600, function () {
            $(this).css('opacity', '0');
          });

        $('#tipBT')
          .css(`opacity`, `0`)
          .animate({ opacity: 1 }, 600, function () {
            $(this).css('opacity', '1');
          });
      }, 5000);
    }
  });

  $('.endBT').on('click', function () {
    window.location.href = './index.html';
  });

  init();
});
