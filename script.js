$(document).ready(function () {
  //사이드바 내 버튼 인터렉션//
  $('.button').removeClass('active');

  // 첫 번째 버튼에 active 클래스 추가
  $('.button:first').addClass('active');

  //웹캠 적용 코드
  const URL = './model/';
  let model, webcam, ctx, maxPredictions;

  //상태 변수
  const state = {
    activeLabel: null, // 현재 10초 조건을 만족하려는 클래스 이름
    startTime: null, // activeLabel의 시작 시간
    threshold: 0.5, // 예측 확률 기준값
    duration: 3000, // 10초 (ms)
  };

  // 모델 및 웹캠 초기화 함수
  async function init() {
    try {
      const modelURL = URL + 'model.json';
      const metadataURL = URL + 'metadata.json';

      // 모델 로드
      model = await tmPose.load(modelURL, metadataURL);
      console.log('모델 로드 성공:', model);
      maxPredictions = model.getTotalClasses();

      // 웹캠 설정 및 시작
      const flip = true; // 카메라 반전 여부
      webcam = new tmPose.Webcam(766, 766, flip); // width, height, flip
      await webcam.setup(); // 카메라 접근 요청
      await webcam.play(); // 카메라 재생
      console.log('웹캠 로드 성공');

      // `canvas` 요소에 웹캠 연결
      const canvas = document.getElementById('canvas');
      canvas.width = 634;
      canvas.height = 766;
      ctx = canvas.getContext('2d');

      // 예측 루프 시작
      window.requestAnimationFrame(loop);
    } catch (err) {
      console.error('초기화 실패:', err);
    }
  }

  // 예측 루프
  async function loop() {
    webcam.update(); // 웹캠 프레임 갱신
    await predict(); // 예측 수행
    window.requestAnimationFrame(loop);
  }

  // 예측 함수
  async function predict() {
    if (!webcam || !model) return;

    // 티처블머신을 통해 포즈 추정
    const { pose, posenetOutput } = await model.estimatePose(webcam.canvas);
    const predictions = await model.predict(posenetOutput);

    //확률 0.5 이상 10초 유지 조건
    processPredictions(predictions);

    // 포즈 그리기
    drawPose(pose);
  }

  function processPredictions(predictions) {
    const currentTime = Date.now();
    const topPrediction = predictions.reduce((max, pred) =>
      pred.probability > max.probability ? pred : max
    );

    // 조건: 확률이 threshold 이상인 경우
    if (topPrediction.probability > state.threshold) {
      // 이전 activeLabel과 같은 경우
      if (state.activeLabel === topPrediction.className) {
        // 3초 이상 유지된 경우 처리
        if (currentTime - state.startTime >= state.duration) {
          console.log(
            `3초 동안 유지된 클래스: ${
              state.activeLabel
            } (확률: ${topPrediction.probability.toFixed(2)})`
          );
          // 원하는 데이터 처리
          updateChart(state.activeLabel);

          // 상태 초기화
          state.activeLabel = null;
          state.startTime = null;
        }
      } else {
        // 새로운 클래스가 threshold를 넘긴 경우
        state.activeLabel = topPrediction.className;
        state.startTime = currentTime;
      }
    } else {
      // threshold를 만족하지 못하면 상태 초기화
      state.activeLabel = null;
      state.startTime = null;
    }
  }

  // 포즈 그리기 함수
  function drawPose(pose) {
    if (!webcam.canvas) return;

    // 웹캠 프레임을 캔버스에 그리기
    ctx.drawImage(webcam.canvas, 0, 0);

    // 포즈 키포인트와 골격 그리기
    if (pose) {
      const minPartConfidence = 0.5;
      tmPose.drawKeypoints(pose.keypoints, minPartConfidence, ctx);
      tmPose.drawSkeleton(pose.keypoints, minPartConfidence, ctx);
    }
  }
  //클래스 인식 시 value 값 1 추가 로직
  function updateChart(detectedLabel) {
    data = data.map((item) => {
      if (item.name === detectedLabel) {
        return { ...item, value: item.value + 1 };
      }
      return item;
    });
    myChart.setOption({
      ...option,
      series: [{ data: data.map((d) => d.value) }],
    });
  }

  // 초기화 호출
  init();

  const timelineContainer = $('.timeline .scroll-container'); // 타임라인 컨테이너

  // 타임라인에 데이터 추가 함수
  function addTimelineEntry(time, label) {
    // 중복된 시간 확인
    const existingEntry = timelineContainer.find('li h2').filter(function () {
      return $(this).text() === time; // 이미 같은 시간의 <h2>가 있는지 확인
    });

    // 중복된 시간이 없을 때만 추가
    if (existingEntry.length === 0) {
      const newEntry = `
        <li>
          <h2>${time}</h2>
          <p>${label}</p>
        </li>
        <hr class="line"></hr>
      `;

      // 타임라인에 새 항목 추가
      timelineContainer.prepend(newEntry);

      // 오래된 항목 제거 (최대 5개 유지)
      const timelineItems = timelineContainer.find('li');
      if (timelineItems.length > 5) {
        timelineItems.last().next('hr').remove(); // 마지막 항목의 <hr> 제거
        timelineItems.last().remove(); // 마지막 항목 제거
      }
    }
  }

  // 현재 시간을 HH:MM:SS 형식으로 반환
  function getCurrentTime() {
    const now = new Date();
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');
    return `${hours}:${minutes}:${seconds}`;
  }

  async function processPredictions(predictions) {
    const currentTime = Date.now();
    const topPrediction = predictions.reduce((max, pred) =>
      pred.probability > max.probability ? pred : max
    );

    if (topPrediction.probability > state.threshold) {
      if (state.activeLabel === topPrediction.className) {
        if (currentTime - state.startTime >= state.duration) {
          // 타임라인에 데이터 추가
          addTimelineEntry(getCurrentTime(), state.activeLabel);

          // 차트 업데이트 (선택 사항)
          updateChart(state.activeLabel);

          // 상태 초기화
          state.activeLabel = null;
          state.startTime = null;
        }
      } else {
        state.activeLabel = topPrediction.className;
        state.startTime = currentTime;
      }
    } else {
      state.activeLabel = null;
      state.startTime = null;
    }
  }

  const data = [
    { name: '화면 이탈', value: 0, status: '좋음' },
    { name: '거북이 목', value: 0, status: '좋음' },
    { name: '턱 괴기', value: 0, status: '나쁨' },
    { name: '어깨 비틀림', value: 0, status: '경고' },
  ];

  function updateChart(label) {
    // 데이터 항목에서 해당 라벨 찾기
    const dataItem = data.find((item) => item.name === label);
    if (!dataItem) return; // 해당 라벨이 데이터에 없으면 종료

    // 해당 라벨의 값 증가
    dataItem.value += 1;

    if (dataItem.value >= 1 && dataItem.value <= 5) {
      dataItem.status = '좋음';
    } else if (dataItem.value > 5 && dataItem.value <= 10) {
      dataItem.status = '경고';
      $(`.chart-row[data-label="${dataItem.name}"] .chart-status`)
        .text('경고')
        .removeClass('status-good')
        .addClass('status-warning');
    } else if (dataItem.value > 10) {
      dataItem.status = '나쁨';
      $(`.chart-row[data-label="${dataItem.name}"] .chart-status`)
        .text('나쁨')
        .removeClass('status-good status-warning')
        .addClass('status-bad');
    }

    // 차트 행과 요소 선택
    const row = $(`.chart-row[data-label="${label}"]`);
    if (row.length === 0) return; // 차트 행이 없으면 종료

    const barFill = row.find('.chart-bar-fill'); // 차트 바
    const valueLabel = row.find('.chart-value'); // 값 레이블

    // 새로운 퍼센트 계산 (최대 100%)
    const percentage = Math.min((dataItem.value / 15) * 100, 100);

    // 차트 업데이트
    barFill.css('width', `${percentage}%`); // 바 너비 설정
    valueLabel.text(`${dataItem.value}회`); // 값 레이블 업데이트
  }
});
