const $mediaForm = document.getElementById('mediaForm');
const $title = document.getElementById('title');
const $updateFocus = document.getElementById('updateFocus');
const $browseDialog = document.getElementById('browseDialog');
const $selectQuery = document.getElementById('selectQuery');
const $accession = document.getElementById('accession');
const $link = document.getElementById('link');
const $personFirst = document.getElementById('personFirst');
const $personLast = document.getElementById('personLast');
const $description = document.getElementById('description');
const $dateYear = document.getElementById('dateYear');
const $dateMonth = document.getElementById('dateMonth');
const $dateDay = document.getElementById('dateDay');
const $locationDetail = document.getElementById('locationDetail');
const $locationCity = document.getElementById('locationCity');
const $locationState = document.getElementById('locationState');
const $sourPersonFirst = document.getElementById('sourPersonFirst');
const $sourPersonLast = document.getElementById('sourPersonLast');
const $sourYear = document.getElementById('sourYear');
const $sourMonth = document.getElementById('sourMonth');
const $sourDay = document.getElementById('sourDay');

$browseDialog.addEventListener('click', (event) => {
  let queryType = {
    type: $selectQuery.value,
    directory: $updateFocus.value
  };
  
  EMPANADA.sendToMain(EMPANADA.req.SHOWDIRDIALOG, JSON.stringify(queryType));
});

$mediaForm.addEventListener('submit', (event) => {
  if (!$updateFocus.value) {
    alert('Error: Please enter something in the Directory or Collection field.');
    return;
  }
  let formData = new FormData($mediaForm);
  let formJSON = Object.fromEntries(formData);
  formJSON.updateFocus = $updateFocus.value;
  EMPANADA.sendToMain(EMPANADA.req.ADDMEDIA, JSON.stringify(formJSON));
});

EMPANADA.onAddMediaShowDirectory((data) => {
  $mediaForm.reset();
  let response = JSON.parse(data);
  $title.value = response.text;
  $updateFocus.value = response.value;
  if (response.selectQuery) {
    $selectQuery.value = response.selectQuery;
  }
  if (response.accession) {
    $accession.value = response.accession;
  }
  if (response.link) {
    $link.value = response.link;
  }
  if (response.personFirst) {
    $personFirst.value = response.personFirst;
  }
  if (response.personLast) {
    $personLast.value = response.personLast;
  }
  if (response.description) {
    $description.value = response.description;
  }
  if (response.dateYear) {
    $dateYear.value = response.dateYear;
  }
  if (response.dateMonth) {
    $dateMonth.value = response.dateMonth;
  }
  if (response.dateDay) {
    $dateDay.value = response.dateDay;
  }
  if (response.locationDetail) {
    $locationDetail.value = response.locationDetail;
  }
  if (response.locationCity) {
    $locationCity.value = response.locationCity;
  }
  if (response.locationState) {
    $locationState.value = response.locationState;
  }
  if (response.sourPersonFirst) {
    $sourPersonFirst.value = response.sourPersonFirst;
  }
  if (response.sourPersonLast) {
    $sourPersonLast.value = response.sourPersonLast;
  }
  if (response.sourYear) {
    $sourYear.value = response.sourYear;
  }
  if (response.sourMonth) {
    $sourMonth.value = response.sourMonth;
  }
  if (response.sourDay) {
    $sourDay.value = response.sourDay;
  }
});