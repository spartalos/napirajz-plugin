function httpGet(url, callback){
  var xmlHttp = new XMLHttpRequest();
  xmlHttp.onreadystatechange = function(){
    if(xmlHttp.readyState == 4 && xmlHttp.status == 200){
      callback(xmlHttp.responseText);
    }
  }
  xmlHttp.open("GET", url, true);
  xmlHttp.send(null);
}

function createImageElement(imageUrl){
  var imgTag=document.createElement("img");
      imgTag.setAttribute('src', imageUrl);
      imgTag.setAttribute('alt', 'na');
      imgTag.setAttribute('style', 'max-width: 100%;');
  return imgTag;
}

function getFormattedDate(){
  var today = new Date();
  return today.getFullYear() + '-' + today.getMonth()+1 + '-' + today.getDate();
}

function getRandom(){
  httpGet('http://kereso.napirajz.hu/abort.php?guppi&json', 
          function(responseRand){
            document.getElementById('kepdiv').innerHTML = '';
            document.getElementById('kepdiv').appendChild(createImageElement(getFirst(JSON.parse(responseRand))));
          });
}

function getFirst(responseJson){
  for(pic in responseJson){
    return responseJson[pic].URL;
  }
}

function getToday(){
  var todayParam = getFormattedDate();

  httpGet('http://kereso.napirajz.hu/abort.php?n=1&tol=' + todayParam + '&ig=' + todayParam + '&json', 
    function(response){
      var parsedResponse = JSON.parse(response);
      if(parsedResponse.length == 0){
        document.getElementById('kepdiv').innerHTML = 'Nem volt feltöltve rajz a napiszörcsre mai dátummal :('
      }else{
        document.getElementById('kepdiv').innerHTML = '';
        document.getElementById('kepdiv').appendChild(createImageElement(getFirst(parsedResponse)));
      }
    });
}

window.onload = function(){
  var todayButton = document.getElementById('maiDiv');
  todayButton.onclick = function(){
    getToday();
  }
  var randomButton = document.getElementById('randomDiv');
  randomButton.onclick = function(){
    getRandom();
  }
  getRandom();
} 