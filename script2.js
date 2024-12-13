const URL = './my_model/';
let model, webcam, ctx, maxPredictions;
let score = 0; // 점수 변수 추가

const state = {
  activeLabel: null,
  startTime: null,
  threshold: 0.5,
  duration: 3000, // 3초 유지 조건 (ms)
};

$(document).ready(function () {
  init();

  setInterval(() => {
    if (bubbles.length < 2) {
      createBubble(); // 비눗방울 최대 2개 유지
    }
  }, 8000); // 8초마다 새로운 비눗방울 생성
});

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
    webcam = new tmPose.Webcam(766, 766, flip);
    await webcam.setup();
    await webcam.play();
    console.log('웹캠 로드 성공');

    // canvas 설정
    const canvas = $('#canvas')[0];
    canvas.width = 634;
    canvas.height = 766;
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
        updateScore(); // 점수 업데이트

        const matchedBubble = bubbles.find(
          (bubble) => bubble.targetClass === topPrediction.className
        );
        if (matchedBubble) {
          removeBubble(matchedBubble.id); // 비눗방울 제거
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
  score += 1;
  console.log(`Score: ${score}`);
  $('#score-container').text(`Score: ${score}`);
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

let bubbles = []; // 활성 비눗방울 저장
const bubbleDuration = 10000; // 비눗방울 지속 시간 (ms)

function createBubble() {
  const bubbleContainer = $('#bubble-container');
  // 비눗방울 ID와 목표 자세 랜덤 생성
  const bubbleId = `bubble-${Date.now()}`;

  // 방향 좌우로 한정 (좌측: 10~30%, 우측: 70~90%)
  const isLeft = Math.random() < 0.5; // 좌측(50%) 또는 우측(50%)
  const leftPosition = isLeft
    ? Math.random() * 10 + 10 // 좌측: 10% ~ 30%
    : Math.random() * 10 + 70; // 우측: 70% ~ 90%
  const topPosition = Math.random() * 10 + 50;

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

// 비눗방울 제거 함수
function removeBubble(bubbleId) {
  $(`#${bubbleId}`).remove();
  bubbles = bubbles.filter((bubble) => bubble.id !== bubbleId);
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
