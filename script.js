$(document).ready(function () {
  //사이드바 내 버튼 인터렉션//
  $('.button').removeClass('active');

  // 첫 번째 버튼에 active 클래스 추가
  $('.button:first').addClass('active');

  //Teachable Machine 모델 적용 코드
  function startCamera() {
    navigator.mediaDevices
      .getUserMedia({ video: true }) // 카메라 스트림 요청
      .then((stream) => {
        videoElement.srcObject = stream; // 스트림을 <video> 요소에 연결
        videoElement.play(); // 비디오 재생 시작
      })
      .catch((err) => {
        console.error('카메라 접근 실패:', err);
        alert('카메라를 사용할 수 없습니다. 권한을 허용했는지 확인하세요.');
      });
  }

  startCamera();

  const webcamElement = document.getElementById('webcam');
  const resultElement = document.getElementById('result');

  async function init() {
    const modelURL = './model/model.json';

    async function loadModel() {
      const model = await tf.loadLayersModel(modelURL);
      console.log('Teachable Machine 모델 로드 완료');
      return model;
    }
    // 카메라 스트림 연결
    const stream = await navigator.mediaDevices.getUserMedia({ video: true });
    webcamElement.srcObject = stream;
    webcamElement.play();

    // 카메라 데이터가 로드되면 예측 시작
    webcamElement.onloadeddata = () => {
      setInterval(() => detectPose(model), 100); // 100ms 간격으로 예측
    };
  }

  async function startCamera() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true }); // 카메라 스트림 요청
      const videoElement = document.getElementById('webcam'); // 비디오 태그 가져오기
      videoElement.srcObject = stream; // 스트림 연결
      videoElement.play(); // 비디오 재생
    } catch (err) {
      console.error('카메라 접근 실패:', err);
      alert('카메라를 사용할 수 없습니다. 권한을 허용했는지 확인하세요.');
    }
  }
  startCamera();

  async function detectPose(model) {
    // 비디오를 Tensor로 변환
    const inputTensor = tf.browser
      .fromPixels(webcamElement)
      .resizeBilinear([634, 766])
      .expandDims()
      .toFloat()
      .div(255);

    // 모델 예측 수행
    const predictions = await model.predict(inputTensor).data();

    // 예측 결과를 출력
    const maxIndex = predictions.indexOf(Math.max(...predictions));
    const labels = ['포즈 1', '포즈 2', '포즈 3', '포즈 4'];
    resultElement.textContent = `인식된 포즈: ${labels[maxIndex]} (확률: ${(
      predictions[maxIndex] * 100
    ).toFixed(2)}%)`;

    inputTensor.dispose(); // 메모리 해제
  }

  //막대그래프 생성//
  let chartDom = $(`.chart`)[0];
  let myChart = echarts.init(chartDom);

  let data = [
    { name: '화면 이탈', value: 2, status: '좋음', color: '#DFF6E1' },
    { name: '거북이 목', value: 2, status: '좋음', color: '#DFF6E1' },
    { name: '턱 괴기', value: 7, status: '나쁨', color: '#FDE8E8' },
    { name: '어깨 비틀림', value: 5, status: '경고', color: '#FFF4E0' },
  ];

  var option = {
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
});
