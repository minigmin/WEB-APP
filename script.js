$(document).ready(function () {
  const sidebar = $(`.sidebar`);
  const gridContainer = $(`.grid-container`);
  const triggerZone = $(`.trigger-zone`);

  triggerZone.on(`mouseenter`, function () {
    sidebar.css(`transform`, `translateX(0)`);
    gridContainer.css(`grid-template-columns`, `176px 1fr`);
  });

  triggerZone.on(`mouseleave`, function () {
    sidebar.css(`transform`, `translateX(-176px)`);
    gridContainer.css(`grid-template-columns`, `0px 1fr`);
  });
});
