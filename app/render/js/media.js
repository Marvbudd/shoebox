const $previewDiv = document.getElementById("previewDiv");
const $prevDataDiv = document.getElementById("prevDataDiv")

let a = 0
$prevDataDiv.addEventListener('dblclick', (e) => {
  var detailElements = document.getElementsByClassName('detail')
  for (var i = 0; i < detailElements.length; i++) {
    if (a == 0) {
      detailElements[i].style.display = 'table-row'
    } else {
      detailElements[i].style.display = 'none'
    }
  }
  a = a == 0 ? 1 : 0
})

function mediaContent(itemString) {
  const itemObject = JSON.parse(itemString)
  $prevDataDiv.innerHTML = itemObject.descDetail
  $previewDiv.innerHTML = itemObject.mediaTag
  document.title = itemObject.link
  if (itemObject.entry) {
    var $mediaObject = $previewDiv.querySelector('#previewAudio')
    if (!$mediaObject) {
      $mediaObject = $previewDiv.querySelector('#previewVideo')
    }
    if ($mediaObject) {
      $mediaObject.currentTime = itemObject.entry.startSeconds
      $mediaObject.play()
      setTimeout(() => {
        $mediaObject.pause()
      }, itemObject.entry.durationSeconds * 1000);
    }
  }
  a = 0
}
TACO.onMediaDisplay(mediaContent)