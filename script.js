$(document).ready(function () {
  tf.setBackend('cpu');

  //사이드바 내 버튼 인터렉션//
  $('.button').removeClass('active');

  // 첫 번째 버튼에 active 클래스 추가
  $('.button:first').addClass('active');

  //Teachable Machine 적용 코드

  //웹캠 적용 코드
  const videoElement = $('#webcam')[0];
  const resultElement = $('#result');
  const targetElement = $('.target');
  let model;
  let labels = []; // metadata.json에서 라벨 정보를 저장
  const labelCounts = {}; // 각 포즈별 인식 횟수 저장
  const modelURL = './model/model.json';
  const metadataURL = './model/metadata.json'; // metadata.json 경로

  function startCamera() {
    navigator.mediaDevices
      .getUserMedia({
        video: {
          width: { ideal: 634 }, // 너비 설정
          height: { ideal: 766 }, // 높이 설정
        },
      })
      .then((stream) => {
        videoElement.srcObject = stream; // 스트림을 <video> 요소에 연결
        videoElement.play(); // 비디오 재생 시작
      })
      .catch((err) => {
        console.error('카메라 접근 실패:', err);
        alert('카메라를 사용할 수 없습니다. 권한을 허용했는지 확인하세요.');
      });
  }

  async function loadModel() {
    try {
      model = await tf.loadLayersModel(modelURL);
      console.log('Teachable Machine 모델 로드 완료');

      const response = await fetch(metadataURL);
      const metadata = await response.json();
      labels = metadata.labels; // metadata에서 라벨 가져오기
      labels.forEach((label) => {
        labelCounts[label] = 0; // 각 라벨의 초기 인식 횟수 0으로 설정
      });

      console.log('Metadata 로드 완료:', labels);
    } catch (err) {
      console.error('모델 또는 metadata 로드 실패:', err);
      alert('모델 및 metadata 로드에 실패했습니다. 경로를 확인하세요.');
    }
  }

  async function detectPose() {
    if (!model || labels.length === 0) return;

    // 웹캠 영상을 Tensor로 변환
    const inputTensor = tf.browser
      .fromPixels(videoElement)
      .resizeBilinear([224, 224]) // 모델 입력 크기로 조정
      .expandDims(0)
      .toFloat()
      .div(255); // 정규화

    // 모델 예측 수행
    const predictions = await model.predict(inputTensor).data();
    const maxIndex = predictions.indexOf(Math.max(...predictions));
    const confidence = (predictions[maxIndex] * 100).toFixed(2); // 확률 계산

    // 결과 출력
    const detectedLabel = labels[maxIndex];
    resultElement.text(`인식된 포즈: ${detectedLabel} (확률: ${confidence}%)`);
    labelCounts[detectedLabel] += 1; // 해당 포즈의 인식 횟수 증가
    console.log(`인식된 포즈: ${detectedLabel}, 확률: ${confidence}%`);
    console.log(`전체 예측 결과:`, predictions);
    console.log('현재 포즈별 인식 횟수:', labelCounts);

    targetElement.removeClass(
      labels.map((_, index) => `pose-${index + 1}`).join(' ')
    ); // 이전 클래스 제거
    targetElement.addClass(`pose-${maxIndex + 1}`); // 새로운 클래스 추가

    console.log('현재 포즈 인식 횟수:', labelCounts);

    updateData(detectedLabel);

    inputTensor.dispose(); // 메모리 해제

    // 다음 프레임 예측
    requestAnimationFrame(detectPose);
  }

  async function init() {
    await loadModel(); // 모델과 metadata 로드
    startCamera(); // 카메라 시작

    // 비디오 데이터가 로드되면 포즈 감지 시작
    videoElement.onloadeddata = () => {
      console.log('비디오 로드 완료');
      detectPose(); // 포즈 감지 시작
    };
  }

  // 초기화 호출
  init();

  //막대그래프 생성//
  let data = [
    { name: '화면 이탈', value: 0, status: '좋음', color: '#DFF6E1' },
    { name: '거북이 목', value: 0, status: '좋음', color: '#DFF6E1' },
    { name: '턱 괴기', value: 0, status: '나쁨', color: '#FDE8E8' },
    { name: '어깨 비틀림', value: 0, status: '경고', color: '#FFF4E0' },
  ];

  let chartDom = $(`.chart`)[0];
  let myChart = echarts.init(chartDom);

  let option = {
    tooltip: {
      show: false,
    },
    grid: {
      top: '0',
      left: '0',
      right: '100',
      bottom: '-25',
      containLabel: true,
    },
    xAxis: {
      type: 'value',
      max: 10,
      show: false,
    },
    yAxis: {
      type: 'category',
      data: data.map((item) => item.name),
      axisLabel: {
        fontSize: 16,
        fontWeight: `500`,
        color: '#5E6484',
        align: `left`,
        padding: [0, 0, 0, -90],
        boundaryGap: true,
        inverse: false,
        lineHeight: 25,
      },
      axisTick: { show: false },
      axisLine: { show: false },
    },
    series: [
      {
        type: 'bar',
        data: data.map(() => 10), // 모든 막대의 최대값
        barWidth: 25, // 배경 막대 너비
        barGap: `-100%`,
        itemStyle: {
          color: '#E3E3E3', // 배경 막대 색상 (연한 회색)
          borderRadius: [15, 15, 15, 15], // 둥근 모서리
        },
        z: 1, // z-index 낮게 설정
      },
      {
        type: 'bar',
        data: data.map((item) => ({
          value: item.value,
          itemStyle: {
            borderRadius: [0, 24, 24, 0],
            color: {
              type: 'linear', // 선형 그라디언트
              x: 0, // 시작점 x (0: 왼쪽)
              y: 0, // 시작점 y (0: 위쪽)
              x2: 1, // 끝점 x (1: 오른쪽)
              y2: 0, // 끝점 y (0: 위쪽)
              colorStops: [
                { offset: 0, color: '#9FAEFF' }, // 시작 색상
                { offset: 1, color: '#768BFF' }, // 끝 색상
              ],
            },
          },
        })),
        barWidth: 25,
        label: {
          show: true,
          position: 'right',
          formatter: (params) => `${data[params.dataIndex].value}회`,
          color: '#627BFF',
          fontSize: 14,
          fontWeight: `600`,
          align: `center`,
          distance: 20,
        },
      },
    ],
    graphic: data.map((item, index) => ({
      type: 'group',
      left: '84%',
      top: `${index * 26 + 4}%`,
      children: [
        {
          type: 'rect',
          shape: { width: 70, height: 30, r: 15 },
          style: { fill: item.color, stroke: 'none' },
        },
        {
          type: 'text',
          left: 21,
          top: 9,
          style: {
            text: item.status,
            fontSize: 14,
            fill: getTextColor(item.status),
            fontWeight: '600',
            align: 'center',
            verticalAlign: 'middle',
          },
        },
      ],
    })),
  };

  function updateChart() {
    const updatedData = data.map((item) => ({
      value: item.value,
      itemStyle: {
        borderRadius: [0, 24, 24, 0],
        color: {
          type: 'linear',
          x: 0,
          y: 0,
          x2: 1,
          y2: 0,
          colorStops: [
            { offset: 0, color: '#9FAEFF' },
            { offset: 1, color: '#768BFF' },
          ],
        },
      },
    }));
  }

  myChart.setOption(option);

  function getTextColor(status) {
    // 상태에 따라 텍스트 색상 반환
    switch (status) {
      case '좋음':
        return '#3FB650'; // 초록색 (좋음)
      case '나쁨':
        return '#EC5F45'; // 빨간색 (나쁨)
      case '경고':
        return '#FEB947'; // 주황색 (경고)
      default:
        return '#5E6484'; // 기본 색상
    }
  }

  function updateData(detectedLabel) {
    data = data.map((item) => {
      if (item.name === detectedLabel) {
        return { ...item, value: item.value + 1 };
      }
      return item;
    });
    updateChart();
  }
});
