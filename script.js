$(document).ready(function () {
  //사이드바 내 버튼 인터렉션//
  $('.button').removeClass('active');

  // 첫 번째 버튼에 active 클래스 추가
  $('.button:first').addClass('active');

  $('#Bell').on('click', function () {
    // 현재 이미지 src 확인 후 변경
    const src = $(this).attr('src');
    if (src.includes('Bell.png')) {
      $(this).attr('src', 'image/Bell_dark.png'); // 다른 이미지 경로
    } else {
      $(this).attr('src', 'image/Bell.png');
      alertSound.pause(); // 원래 이미지 경로
    }
  });

  var today = new Date();
  let year = today.getFullYear();
  let month = String(today.getMonth() + 1).padStart(2, '0'); // 월은 0부터 시작하므로 +1
  let day = String(today.getDate()).padStart(2, '0');

  // 포맷팅된 날짜 문자열 생성
  var formattedDate = year + '.' + month + '.' + day;

  // 날짜를 <p> 태그에 삽입
  $('#date').text(formattedDate);

  //웹캠 적용 코드
  const URL = './model/';
  let model, webcam, ctx, maxPredictions;

  //상태 변수
  const state = {
    activeLabel: null, // 현재 10초 조건을 만족하려는 클래스 이름
    startTime: null, // activeLabel의 시작 시간
    threshold: 0.8, // 예측 확률 기준값
    duration: 3000, // 10초 (ms)
  };

  const alertSounds = {
    '화면 이탈': $('#alert-screen')[0],
    '거북이 목': $('#alert-turtle')[0],
    '턱 괴기': $('#alert-chin')[0],
    '어깨 비틀림': $('#alert-shoulder')[0],
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

    // 모든 데이터 값 검사: 16 이상이면 함수 종료
    const isMaxValueReached = data.some((item) => item.value >= 16);
    if (isMaxValueReached) {
      console.log('값이 16 이상입니다. processPredictions 함수 종료.');
      return; // 함수 실행 중단
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

  function addTimelineEntry(time, label) {
    const existingEntry = timelineContainer.find('li h2').filter(function () {
      return $(this).text() === time;
    });
    const imageMap = {
      '화면 이탈': 'image/timeline_icon1.png',
      '거북이 목': 'image/timeline_icon3.png',
      '턱 괴기': 'image/timeline_icon2.png',
      '어깨 비틀림': 'image/timeline_icon4.png',
    };

    const imageSrc = imageMap[label];

    if (existingEntry.length === 0) {
      const newEntry = `
      <li>
      <div class="timeline_container">
        <img src="${imageSrc}">
        <div class="timeline_container_small">
          <p>${label}</p>
          <h2>${time}</h2>
        </div>
      </div>
    </li>
    <hr class="line"></hr>
      `;

      timelineContainer.prepend(newEntry);

      const timelineItems = timelineContainer.find('li');
      if (timelineItems.length > 5) {
        timelineItems.last().next('hr').remove();
        timelineItems.last().remove();
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

          let alertSound = alertSounds[state.activeLabel];
          if (alertSound) {
            let currentSrc = $('#Bell').attr('src');

            if (currentSrc.includes('Bell.png')) {
              alertSound.pause();
              alertSound.currentTime = 0;
            } else {
              alertSound.currentTime = 0;
              alertSound.play();
            }
          }

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

    if (dataItem.value >= 16) {
      console.log(`${label}의 값이 이미 16 이상입니다. 함수 종료.`);
      return;
    }

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
    } else if (dataItem.value > 10 && dataItem.value <= 15) {
      dataItem.status = '나쁨';
      $(`.chart-row[data-label="${dataItem.name}"] .chart-status`)
        .text('나쁨')
        .removeClass('status-good status-warning')
        .addClass('status-bad');
    } else if (dataItem.value == 16) {
      modalUP();
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

  function modalUP() {
    $('#pop-up')
      .css({ opacity: '0', zIndex: '2' })
      .animate({ opacity: 1 }, 600, function () {
        $(this).css('opacity', '1');
      });
    console.log('모달 등장');
  }

  $('.start_button').on('click', function () {
    window.location.href = './stretch.html';
  });
});
