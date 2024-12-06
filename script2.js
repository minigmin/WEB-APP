$(document).ready(function () {
  $('.button').removeClass('active');

  // 첫 번째 버튼에 active 클래스 추가
  $('.button:last').addClass('active');
});
