const URL = './my_model/';
let model, webcam, ctx, maxPredictions;
let score = 0; // 점수 변수 추가

const state = {
  activeLabel: null,
  startTime: null,
  threshold: 0.8,
  duration: 3000, // 3초 유지 조건 (ms)
};

$(document).ready(function () {
  // 모델 및 웹캠 초기화 함수
  async function init() {
    try {
      const modelURL = URL + 'model.json';
      const metadataURL = URL + 'metadata.json';

      // 모델 로드
      model = await tmPose.load(modelURL, metadataURL);
      console.log('모델 로드 성공');
      maxPredictions = model.getTotalClasses();

      classLabels = model.getClassLabels();
      console.log('클래스 이름:', classLabels);

      // 웹캠 설정
      const flip = true;
      webcam = new tmPose.Webcam(1440, 1024, flip);
      await webcam.setup();
      await webcam.play();
      console.log('웹캠 로드 성공');

      // canvas 설정
      const canvas = $('#canvas')[0];
      canvas.width = 1440;
      canvas.height = 1024;
      ctx = canvas.getContext('2d');

      // 예측 루프 시작
      requestAnimationFrame(loop);
    } catch (err) {
      console.error('초기화 실패:', err);
    }
  }

  // 예측 루프
  async function loop() {
    webcam.update(); // 웹캠 프레임 갱신
    await predict(); // 예측 수행
    requestAnimationFrame(loop);
  }

  // 예측 함수
  async function predict() {
    if (!webcam || !model) return;

    // 포즈 추정
    const { pose, posenetOutput } = await model.estimatePose(webcam.canvas);
    const predictions = await model.predict(posenetOutput);

    // 예측 처리
    processPredictions(predictions);

    // 포즈 그리기
    drawPose(pose);
  }

  function processPredictions(predictions) {
    const currentTime = Date.now();

    const excludedClassIndex = 2; // 0-based 인덱스, 3번째 클래스 = 인덱스 2
    const excludedClassName = predictions[excludedClassIndex]?.className; // 3번째 클래스의 이름 확인

    const topPrediction = predictions.reduce((max, pred) =>
      pred.probability > max.probability ? pred : max
    );

    // threshold 조건 확인
    if (topPrediction.probability > state.threshold) {
      if (state.activeLabel === topPrediction.className) {
        // 3초 이상 유지된 경우 처리
        if (
          currentTime - state.startTime >= state.duration &&
          topPrediction.className !== excludedClassName
        ) {
          console.log(`3초 동안 유지된 클래스: ${state.activeLabel}`);

          const matchedBubble = bubbles.find(
            (bubble) => bubble.targetClass === topPrediction.className
          );
          if (matchedBubble) {
            removeBubble(matchedBubble.id); // 비눗방울 제거
            updateScore(); // 점수 업데이트
          }

          resetState(); // 상태 초기화
        }
      } else {
        // 새로운 클래스가 threshold를 넘긴 경우
        state.activeLabel = topPrediction.className;
        state.startTime = currentTime;
      }
    } else {
      resetState(); // threshold를 만족하지 못하면 초기화
    }
  }

  function resetState() {
    state.activeLabel = null;
    state.startTime = null;
  }

  // 점수 업데이트 함수
  function updateScore() {
    // **최대 점수를 5점으로 제한**
    if (score >= 5) {
      console.log('최대 점수에 도달했습니다.');
      return;
    }

    score += 1;
    console.log(`Score: ${score}`);
    // **점수가 올라갈 때 해당 `.bubble-score`에 `active` 클래스 추가**
    const scoreElement = $('.score-box .bubble-score').eq(score - 1);
    if (scoreElement.length > 0) {
      scoreElement.addClass('active');
      console.log(`Score bubble activated: ${score}`);
    }

    // **color-bar 길이 증가 로직 추가**
    const colorBar = $('#process-bar .color-bar');
    const currentWidth = parseInt(colorBar.css('width')) || 0; // 현재 너비 가져오기
    const maxWidth = window.innerWidth; // 최대 너비 (1440px)
    const increase = maxWidth / 5;
    const newWidth = Math.min(currentWidth + increase, maxWidth); // 증가된 너비 계산

    colorBar.css('width', `${newWidth}px`); // 업데이트
    console.log(`Color bar updated: ${newWidth}px`);
  }

  // 포즈 그리기 함수
  function drawPose(pose) {
    if (!webcam.canvas) return;

    // 캔버스에 웹캠 프레임 그리기
    ctx.drawImage(webcam.canvas, 0, 0);

    // 포즈 키포인트와 골격 그리기
    if (pose) {
      const minPartConfidence = 0.5;
      tmPose.drawKeypoints(pose.keypoints, minPartConfidence, ctx);
      tmPose.drawSkeleton(pose.keypoints, minPartConfidence, ctx);
    }
  }

  // 비눗방울 제거 함수
  function removeBubble(bubbleId) {
    const bubbleElement = $(`#${bubbleId}`);

    // 비눗방울의 background-image를 GIF로 변경
    bubbleElement.css({
      backgroundImage: 'url(./image/버블터질때.gif)', // GIF 경로
      backgroundSize: 'cover', // GIF 크기 맞추기
      backgroundRepeat: 'no-repeat', // 반복 방지
      backgroundPosition: 'center', // 중앙 정렬
    });

    const overlay = $('#overlay');
    overlay.show(); // 오버레이 표시
    overlay
      .fadeIn(200)
      .delay(300)
      .fadeOut(600, () => {
        overlay.hide(); // 오버레이 숨김
      });

    // 1초 후 비눗방울 제거
    setTimeout(() => {
      bubbleElement.remove(); // 비눗방울 제거
      bubbles = bubbles.filter((bubble) => bubble.id !== bubbleId); // 배열에서 제거
    }, 500); // 1초 후 제거

    setTimeout(() => {
      bubbleElement.remove(); // 비눗방울 제거
      bubbles = bubbles.filter((bubble) => bubble.id !== bubbleId); // 배열에서 제거
    }, 500); // GIF 재생 시간 동안 유지
  }

  // 랜덤 목표 자세 반환
  function getRandomClass() {
    if (classLabels.length === 0) {
      console.error('클래스 이름이 로드되지 않았습니다.');
      return null;
    }

    const validClasses = classLabels.filter((label, index) => index !== 2); // 3번째 클래스 제외
    const randomClass =
      validClasses[Math.floor(Math.random() * validClasses.length)];
    console.log('랜덤으로 선택된 클래스:', randomClass);
    return randomClass;
  }

  init();

  setInterval(() => {
    if (score >= 5) {
      console.log('최대 점수에 도달했습니다. 비눗방울 생성을 중단합니다.');
      clearInterval(bubbleInterval); // **비눗방울 생성 중단**
      return;
    }

    if (bubbles.length < 2) {
      createBubble(); // 비눗방울 최대 2개 유지
    }
  }, 8000); // 8초마다 새로운 비눗방울 생성

  let bubbles = []; // 활성 비눗방울 저장
  const bubbleDuration = 8000; // 비눗방울 지속 시간 (ms)

  function createBubble() {
    const bubbleContainer = $('#bubble-container');
    // 비눗방울 ID와 목표 자세 랜덤 생성
    const bubbleId = `bubble-${Date.now()}`;

    // 방향 좌우로 한정 (좌측: 10~30%, 우측: 70~90%)
    const isLeft = Math.random() < 0.5; // 좌측(50%) 또는 우측(50%)
    const leftPosition = isLeft
      ? Math.random() * 10 + 20 // 좌측: 10% ~ 30%
      : Math.random() * 10 + 80; // 우측: 70% ~ 90%
    const topPosition = Math.random() * 10 + 60;

    const targetClass = isLeft ? classLabels[0] : classLabels[1]; // 왼쪽 -> 첫 번째 클래스, 오른쪽 -> 두 번째 클래스
    console.log(`비눗방울 생성: ${bubbleId}, 연결된 클래스: ${targetClass}`);

    // 비눗방울 HTML 추가
    const bubble = $(
      `<div class="bubble" id="${bubbleId}" data-target="${targetClass}"></div>`
    );
    bubble.css({
      left: `${leftPosition}%`, // 좌우 위치
      top: `${topPosition}%`, // 상단 위치
    });
    bubbleContainer.append(bubble);

    // 비눗방울 저장
    bubbles.push({ id: bubbleId, targetClass });
    console.log(`Bubble created:`, { id: bubbleId, targetClass });

    // 비눗방울 자동 제거 (시간 초과)
    setTimeout(() => {
      removeBubble(bubbleId);
    }, bubbleDuration);
  }

  $('.modalBT').on('click', function () {
    $('#start-modal')
      .css('opacity', '1')
      .animate({ opacity: 0 }, 600, function () {
        $(this).css('opacity', '0'); // 페이드 아웃 후 요소를 숨김
      });
    console.log('Modal hidden by lowering z-index.');

    let bubbles = []; // 활성 비눗방울 저장
    const bubbleDuration = 8000; // 비눗방울 지속 시간 (ms)

    function createBubble() {
      const bubbleContainer = $('#bubble-container');
      // 비눗방울 ID와 목표 자세 랜덤 생성
      const bubbleId = `bubble-${Date.now()}`;

      // 방향 좌우로 한정 (좌측: 10~30%, 우측: 70~90%)
      const isLeft = Math.random() < 0.5; // 좌측(50%) 또는 우측(50%)
      const leftPosition = isLeft
        ? Math.random() * 10 + 20 // 좌측: 10% ~ 30%
        : Math.random() * 10 + 80; // 우측: 70% ~ 90%
      const topPosition = Math.random() * 10 + 60;

      const targetClass = isLeft ? classLabels[0] : classLabels[1]; // 왼쪽 -> 첫 번째 클래스, 오른쪽 -> 두 번째 클래스
      console.log(`비눗방울 생성: ${bubbleId}, 연결된 클래스: ${targetClass}`);

      // 비눗방울 HTML 추가
      const bubble = $(
        `<div class="bubble" id="${bubbleId}" data-target="${targetClass}"></div>`
      );
      bubble.css({
        left: `${leftPosition}%`, // 좌우 위치
        top: `${topPosition}%`, // 상단 위치
      });
      bubbleContainer.append(bubble);

      // 비눗방울 저장
      bubbles.push({ id: bubbleId, targetClass });
      console.log(`Bubble created:`, { id: bubbleId, targetClass });

      // 비눗방울 자동 제거 (시간 초과)
      setTimeout(() => {
        removeBubble(bubbleId);
      }, bubbleDuration);
    }

    setTimeout(function () {
      $('#tipbox')
        .css('opacity', '1') // 초기 상태 설정
        .animate({ opacity: 0 }, 600, function () {
          $(this).css('opacity', '0'); // 페이드 아웃 후 요소 숨김
        });

      // #tipBT의 opacity를 1로 설정
      $('#tipBT')
        .css('opacity', '0')
        .animate({ opacity: 1 }, 600, function () {
          $(this).css('opacity', '1'); // 페이드 아웃 후 요소 숨김
        });
    }, 5000); // 5000ms = 5초

    setTimeout(function () {
      $('#silhouette-container')
        .css('opacity', '0.5') // 초기 상태 설정
        .animate({ opacity: 0 }, 600, function () {
          $(this).css('opacity', '0'); // 페이드 아웃 후 요소 숨김
        });
    }, 5000); // 5000ms = 5초
  });

  $('#tipBT').on('click', function () {
    // Tipbox의 opacity 상태 확인
    if ($('#tipbox').css('opacity') === '0') {
      // Tipbox의 opacity를 1로 설정하고 5초 후 다시 숨김
      $('#tipbox')
        .css('opacity', '0') // 보이도록 설정
        .animate({ opacity: 1 }, 600, function () {
          $(this).css('opacity', '1'); // 페이드 아웃 후 요소 숨김
        }); // 애니메이션 효과

      $('#tipBT')
        .css(`opacity`, `1`)
        .animate({ opacity: 0 }, 600, function () {
          $(this).css('opacity', '0'); // 완전히 숨김
        });

      // 5초 후 다시 숨김
      setTimeout(function () {
        $('#tipbox')
          .css(`opacity`, `1`)
          .animate({ opacity: 0 }, 600, function () {
            $(this).css('opacity', '0'); // 완전히 숨김
          });

        $('#tipBT')
          .css(`opacity`, `0`)
          .animate({ opacity: 1 }, 600, function () {
            $(this).css('opacity', '1'); // 완전히 숨김
          });
      }, 5000);
    }
  });
});
