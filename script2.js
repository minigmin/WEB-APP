$(document).ready(function () {
  //사이드바 내 버튼 인터렉션//
  const currentPage = window.location.pathname.split('/').pop(); // 파일 이름만 가져옴 (index.html)

  // 각 버튼의 href와 현재 페이지 비교
  $('.button').each(function () {
    const link = $(this).attr('href').split('/').pop(); // href의 파일 이름만 가져옴

    // 현재 페이지와 href가 일치하면 active 클래스 추가
    if (currentPage === link) {
      $(this).addClass('active');
    }
  });
});
