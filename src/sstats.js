/*Todo:
Trim whitespace from beginning/end of data
Currently carries down SVA if student transfers to Swedish - fix this or just
Tell the user?
Year group bar charts don't show carried grades
Teacher previous grades only shows previous semester
No longer starts on student page. Add text to page.
Tabs in year group have wrong class and don't have borders.
Summary lists don't use carried grades
Allow sorting options on summary pages
Colour in summary pages




 Student:
  Bar chart for grade distribution *by year* (with some measure of skew?)
  Averages for merit columns - Maybe not useful.
  Later: (Add in possibility to see National Test in table
        [Use Colspan=2 on EN, SE, MA; SO, NO] columns to allow to be split)
        Some way to ask if qualifies for course? Show in dropdown.
        Add % Absence

 Year Group:
  Show average grade change over time
   - Ratio +ve/-ve slope
  Current grade distribution - DONE!
   - Also select per subject/Subject group
   - Add mouseovers to stacked chart to show values


Subject : 
 ** Selector currently shows year student was in at the time rather than students'
 current year - This is fine but not what happens with the menus in other places**
 Show grade change by subject

 Summary:
   Show students with:
      Have a grade more than (some) SD away from their mean grade
         - Show only students who
      Bimodal grades
        - Currently just lists students. A better way to show this?
      High grade variance
      Grades marked missing
      Currently failing a subject
      Currently failing a *core* subject
         - But are passing other subjects
      Grade changed by more than one letter
         - This year
         - Ever
         - In a core subject
         - Only show students whose grade dropped
            - Only show now F
      Don't qualify for Yrkesprogram
      Do/Don't qualify for a program with given requirements
         - Give default requirements for some courses

    Show teachers who:
      Have low grading variance
      Have +ve skewed grading curves
      Have -ve skewed grading curves

    Show graph of grade changes by frequency
     - Should be +ve skewed normal, flat spots shows inflation/deflation

/*
Currently, this has a different theory on filling in student grades than the
original:
This ONLY fills in missing grades given in the current year. The original will
fill down grades from the previous year to fill in gaps.
It also copies down if the grade is listed as '0' (some kind of mysterious
schoolsoft error) Which the original did not.
*/


var classl = {};
var yearl = {};
var teacherl = {};
var currstudent = {};
var subjects = [];
var mostrecentsemester = "";
var totalsemesters = [];
//headers that aren't subjects contained in grades
var notsubjects = ["MLS", "M2S", "gradeclass"];
//headers for language subjects
var langsubjects = ["EN", "M2", "ML", "SV", "SVA"];
//headers for aesthetic subjects
var aessubjects = ["BL", "HKK", "MU", "SL"];
//headers for SO subjects
var sosubjects = ["HI", "RE", "SH", "GE"];
//headers for NO subjects
var nosubjects = ["BI", "FY", "KE"];
//headers for core subjects
var coresubjects = ["SV", "SVA", "EN", "MA"];
students = d3.tsv("/data/infoblob.tsv");
function student(id, name, grades){
  this.id = id;
  this.name = name;
  this.grades = grades;
}

function makeclass(classl, row){
  classl[row.class] = {};
}

function linreg(data){
  //Takes [{x,y}] data, and calculates gradient and
  //intercept of linear regression
  var xaver = 0;
  var yaver = 0;
  for (let point of data){
    xaver += point.x;
    yaver += point.y;
  }
  xaver = xaver/Object.keys(data).length;
  yaver = yaver/Object.keys(data).length;

  var sxy = 0;
  var s2x = 0;
  for (let point of data){
    sxy += (point.x - xaver)*(point.y - yaver);
    s2x += (point.x - xaver)**2;
  }


  return [sxy/s2x, yaver - (sxy/s2x)*xaver];
}

function median(data){
  //Takes array of numbers. Returns median
  var dlen = data.length;
  if (dlen === 0){
    return 0;
  } else if (dlen === 1){
    return data[0];
      }
  else {
    var sorted = [...data].sort();
    if (dlen%2 === 0){
      var mtop = dlen/2;
      var mbot = dlen/2+1;
        if (!isNaN(mtop) && !isNaN(mbot)){
          return (sorted[mtop]+sorted[mbot])/2;
        } else{
          return [mtop,mbot];
        }
    }else{
      return sorted[dlen/2-0.5];
    }
  }
}

function meanmaxleastres(data, linreg){
  //Takes [{x,y}] data and a [gradient,intercept] pair, and calculates the
  //mean least square residue and max residue
  var residues = 0;
  var mresidue = 0;
    for (let point of data){
       diff = Math.abs(point.y - point.x*linreg[0] - linreg[1]);
       residues += diff;
       if (diff > mresidue) {
        mresidue = diff;
       }
    }
    return [residues/data.length,mresidue];
}

function makestudent(classl, row){
  name = row.fname.concat(" ", row.lname);
  term = row.archiveid.concat(row.term);
  grade = {};
  grade[term] = {};
  classl[row.class][row.studentid] = new student(row.studentid,
                             name,
                             grade);
  classl[row.class][row.studentid].grades[term].gradeclass =
    row.gradeclass;
  classl[row.class][row.studentid].grades[term][row.gradesubject] =
    +row.gradeid;
  if (["ML","M2"].includes(row.gradesubject)) {
    classl[row.class][row.studentid].grades[term]
      [row.gradesubject.concat("S")] =
        row.specialization;
  }
}

function addgradetostudent(studentl, row){
  //check if term row exists:
  //Maybe this is something you're supposed to uses promises for?
  rowterm = row.archiveid.concat(row.term);
  if (rowterm > mostrecentsemester){
    mostrecentsemester = (" " + rowterm).slice(1);
  }
  if (!totalsemesters.includes(rowterm)){
    totalsemesters.push(rowterm);
    totalsemesters.sort();
    totalsemesters.reverse();
  }
  if (Object.keys(studentl[row.studentid].grades).includes(rowterm)){
    studentl[row.studentid].grades[rowterm][row.gradesubject] =
      +row.gradeid;
  }else{
    studentl[row.studentid].grades[rowterm] =
      {"gradeclass": row.gradeclass};
    studentl[row.studentid].grades[rowterm][row.gradesubject] =
      +row.gradeid;
  }
  if (["ML","M2"].includes(row.gradesubject)){
    studentl[row.studentid].grades[rowterm][row.gradesubject.concat("S")] =
        row.specialization;
  }
}

function filldownVTgrades(grades){
  //Fill down missing grades ONLY per term
  terms = Object.keys(grades);
  for (let term of terms) {
    htterm = term.slice(0,2).concat("HT");
    if (term.slice(2) == "VT" && terms.includes(htterm)) {
      //If selected term is summer AND there is a corresponding winter term
      //look for subject that had a grade in winter but not summer
      //and add the grade to the summer.
      vtsubs = Object.keys(grades[term]);
      htsubs = Object.keys(grades[htterm]);
      for (let subj of htsubs) {
        if (!vtsubs.includes(subj) || grades[term][subj] == 0) {
          grades[term][subj] = grades[htterm][subj];
        }
      }
    }
  }
  return grades;
}

function selectnewstudent() {
  //Set carryDown to match checkbox
  if (d3.select("#cdselect").property("checked") == true) {
    localStorage.carryDown = 1;
  }else{
    localStorage.carryDown = 0;
  }
  /* Sets #idselector to studentid of current student
  */
  selectindex = document.getElementById("studentSelector").selectedIndex;
  document.getElementById("idSelector").selectedIndex = selectindex;
  if (selectindex == 0) {
    clearpage();
  } else {
  currentclass = d3.select("#classSelector").property("value");
  currentstudent = d3.select("#idSelector").property("value");

   //If carrying down student grades, make separate student object and
   // recalculate averages
  if (localStorage.carryDown == 1) {
    currstudent = JSON.parse(
    JSON.stringify(classl[currentclass][currentstudent]));
    currstudent.grades = carrydowngrades(currstudent.grades);
    currstudent.merits = termmerits(currstudent.grades);
    currstudent.advanced = advstats(currstudent);
  } else {
    currstudent = classl[currentclass][currentstudent];
  }
  d3.select("#cssettingsbutton").remove();
  makestudenttable(currstudent);
  makescattergraph(currstudent);
  makestudentbargraph(currstudent);
  makeadvanced(currstudent);
        d3.select("#schartsettings").attr("hidden", "true");

      var cssettingsbutton = d3.select("#charts")
                              .append("p")
                              .attr("id", "cssettingsbutton")
                              .html("<u><b>open settings pane</b></u>");

      cssettingsbutton.on("click", function(){
          if (d3.select("#schartsettings").attr("hidden") == "true"){
            d3.select("#schartsettings").attr("hidden", null);
            d3.select("#cssettingsbutton")
              .html("<u><b>close settings pane</b></u>");
          } else {
            d3.select("#schartsettings").attr("hidden", "true");
            d3.select("#cssettingsbutton")
              .html("<u><b>open settings pane</b></u>");
          }
        });
  }
}

function sortidbyname(a,b){
  if (classl[selectValue][a].name < classl[selectValue][b].name) {
    return -1;
  } else if (classl[selectValue][b].name < classl[selectValue][a].name){
    return 1;
  } else {
    return 0;
  }
}

function selectnewclass() {
  /* Changes students in student dropdown to those in selected class
     Changes id numbers in hidden idselector to those in selected class
     Blanks table
    requires: classl
    (should be fine, as only referred to by dropbox created after
    classl is loaded)
  */
  selectindex = document.getElementById("classSelector").selectedIndex;
  selectValue = d3.select("#classSelector").property("value");
  d3.select("#studentSelector")
    .selectAll("option")
    .remove();

  d3.select("#studentSelector")
    .append("option")
    .text("Select a student");

  if (selectindex != 0) {
  keyslist = Object.keys(classl[selectValue]).sort(sortidbyname);
  //sort keyslist by name

  //horrendous kludge to avoid problems wih d3 selectAll
  //Just duplicate the first element of the list
  keyslist.unshift(keyslist[0]);

  d3.select("#studentSelector")
    .selectAll("option")
    .data(keyslist).enter()
    .append("option")
    .text(function(d) {return classl[selectValue][d].name;});

  d3.select("#idSelector")
    .selectAll("option")
    .remove();

  d3.select("#idSelector")
    .selectAll("option")
    .data(keyslist).enter()
    .append("option")
    .text(function(d) { return d;});
  }

  clearpage();
}

function clearpage() {
  d3.select("#bigtable").html("");
  d3.select("#scatterplot").remove();
  d3.select("#cssettingsbutton").remove();
  d3.select("#barchart").remove();
  d3.select("#ybarchartsettings").html("");
  d3.select("#tablesettings").html("");
  d3.select("#schartsettings").attr("hidden", "true");
  d3.select("#advancedinfo").html("");
  d3.select("#teachersummary").html("");
  d3.select("#summaryContent").html("");
  d3.select("#summarySelector").html("");
}

function gradenumtolet(a){
  grades = {
    "1" : "E",
    "2" : "D",
    "3" : "C",
    "4" : "B",
    "5" : "A",
    "6" : "F",
    "7" : "M",
    "8" : "-"
  };
  if (grades[a] != undefined) {return grades[a];}
  else {return a;}
}

function gradelettonum(a){
  grades = {
    "E" : "1",
    "D" : "2",
    "C" : "3",
    "B" : "4",
    "A" : "5",
    "F" : "6",
    "M" : "7",
    "-" : "8"
  };
  if (grades[a] != undefined) {return grades[a];}
  else {return a;}
}

function gradetomerits(a){
  grades = {
    "1" : 10,
    "2" : 12.5,
    "3" : 15,
    "4" : 17.5,
    "5" : 20,
    "6" : 0
  };
  if (grades[a] != undefined) {return grades[a];}
  else {return -1;}
}

function divby0(a,b){
  if (b == 0) {
    return 0;
  } else {
    return a/b ;
  }
}

function gradechangeamount(a,b){
  //takes two number grades, returns grade difference. Returns "n/a" if one
  //isn't a grade

  //Javascript accepts strings as numbers :(
  grades = [1,2,3,4,5,6,"1","2","3","4","5", "6"];
  if (grades.includes(a) && grades.includes(b)){
    //Change grade 6(F) to 0
    a %=6;
    b %=6;
    return b-a;
  }
  else{
    return "n/a";
  }
}

function addtombysubject(merit,subject,mbysubject){
  if (subject in mbysubject){
      mbysubject[subject].total += merit;
      mbysubject[subject].count += 1;
  } else {
    mbysubject[subject] = {"total": merit, "count": 1};
  }
}

function termmerits(grades){
  //Takes a grades object, outputs merits object e.g.
  //{
  //  "tmerits" : {"HT18" : 130, "VT18" : 160},
  //  "tmaverage" :{"HT18": 17.62, "VT18": 6.28}
  //  "tmlangaverage" : {"HT18" : 14.63, "VT18": 18.5}
  //  "tmaesaverage" : {"HT18" : 14.63, "VT18": 18.5} }
  var result = {"tmerits" : {},
          "tmaverage" : {},
          "tmlangaverage" : {},
          "tmaesaverage" : {},
          "tmsoaverage" : {},
          "tmnoaverage" : {},
          "tmcoreaverage" : {},
          "mbysubject" : {}
      };
  var mbysubjecttemp = {};

  for (let term of Object.keys(grades)) {
    var meritsum = 0;
    var langsum = 0;
    var aessum = 0;
    var sosum = 0;
    var nosum = 0;
    var coresum = 0;
    var runcount = 0;
    var langcount = 0;
    var aescount = 0;
    var nocount = 0;
    var socount = 0;
    var corecount = 0;
    for (let subject of Object.keys(grades[term])) {
      if (!notsubjects.includes(subject) &&
          [1,2,3,4,5,6].includes(grades[term][subject])) {
        merits = gradetomerits(grades[term][subject]);
        meritsum += merits;
        runcount += 1;
        if (langsubjects.includes(subject)) {
          langsum += merits;
          langcount += 1;
        }
        if (aessubjects.includes(subject)) {
          aessum += merits;
          aescount += 1;
        }
        if (sosubjects.includes(subject)) {
          sosum += merits;
          socount += 1;
        }
        if (nosubjects.includes(subject)) {
          nosum += merits;
          nocount += 1;
        }
        if (coresubjects.includes(subject)) {
          coresum += merits;
          corecount += 1;
        }
        addtombysubject(merits,subject,mbysubjecttemp);
      }
    }
    if (runcount != 0) {
      result.tmerits[term] = meritsum;
      result.tmaverage[term] = meritsum/runcount;
      result.tmlangaverage[term] = divby0(langsum,langcount);
      result.tmaesaverage[term] = divby0(aessum,aescount);
      result.tmsoaverage[term] = divby0(sosum,socount);
    result.tmnoaverage[term] = divby0(nosum,nocount);
      result.tmcoreaverage[term] = divby0(coresum,corecount);
    } else {
      result.tmerits[term] = 0;
      result.tmaverage[term] = 0;
      result.tmlangaverage[term] = 0;
      result.tmaesaverage[term] = 0;
      result.tmsoaverage[term] = 0;
      result.tmnoaverage[term] = 0;
      result.tmcoreaverage[term] = 0;
    }
  }
  //calculate subject averages and put into object
  for (let subj of Object.keys(mbysubjecttemp)) {
    result.mbysubject[subj] = divby0(mbysubjecttemp[subj].total,
                                      mbysubjecttemp[subj].count);
  }
  return result;
}

function sortsubjectorder(a,b){
  subjectorder =
    {"gradeclass" : -1,
     "BL" : 0,
     "EN" : 4,
      "HKK" : 1,
      "IDH" : 11,
      "MA" : 12,
      "M2" : 7,
      "M2S" : 8,
      "ML" : 9,
      "MLS" : 10,
      "MU" : 2,
      "BI" : 16,
      "FY" :17,
      "KE" :18,
      "GE" : 12,
      "HI" : 13,
      "RE" : 14,
      "SH" : 15,
      "SL" : 3,
      "SV" : 5,
      "SVA" : 6,
      "TK" : 19};
  if (a in subjectorder && b in subjectorder){
    return subjectorder[a] - subjectorder[b];
  } else if (a in subjectorder) {
    return -1;
  } else if (b in subjectorder) {
    return 1;
  } else {return 0;}
}

function sortmeritorder(a,b){
  meritsortorder = {
    "tmerits" : 0,
    "tmaverage" : 10,
    "tmcoreaverage" : 15,
    "tmaesaverage" : 20,
    "tmlangaverage" : 30,
    "tmsoaverage" : 40,
    "tmnoaverage" : 50
  };
  if (a in meritsortorder && b in meritsortorder){
    return meritsortorder[a] - meritsortorder[b];
  } else if (a in meritsortorder) {
    return -1;
  } else if (b in meritsortorder) {
    return 1;
  } else {return 0;}
}

function gettableheaders(data){
  /* Gets list of subjects student has studied
  */
  var subjects = [];
  for (var term in data){
    subjects = subjects.concat(Object.keys(data[term]));
  }
  subjects_Set = new Set(subjects);
  subjects = [...subjects_Set];
  return subjects.sort(sortsubjectorder);
}

function merittonum(merit){
  if (isNaN(merit) || merit == ""){
    return merit;
  }else{
      var asnum = Number(merit);
      if (asnum < 0){
        return merit;
      } else if (asnum < 5){
        return 6;
      } else if (asnum < 11.25){
        return 1;
      } else if (asnum < 13.75){
        return 2;
      } else if (asnum < 16.25){
        return 3;
      } else if (asnum < 18.75){
        return 4;
      } else if (asnum <= 20) {
        return 5;
      } else {
        return merit;
      }
    }
}

function merittolet(merit){
  var num = merittonum(merit);
  return gradenumtolet(num);
}

function getaveragesubjgrade(mbysubj,subj,mode=0){
  //Mode 1 = return request if no such subj
  //otherwise = return blank if no such subj
  var ret = mbysubj[subj];
      if (typeof ret == "number") {
      return ret.toFixed(2);
      } else {
        if (mode == 1){
          return subj;
        } else {
              return "";
        }
      }
}

function carrydowngrades(grades){
  //copies grades down next term if no grade exists
  var cdgrades = JSON.parse(JSON.stringify(grades));
  var terms = Object.keys(cdgrades).sort();
  var subs = Object.keys(cdgrades[terms[0]]);
  for (i = 1; i < terms.length; i++){
      for (let sub of subs){
        if (!(sub in cdgrades[terms[i]])) {
          cdgrades[terms[i]][sub] = cdgrades[terms[i-1]][sub];
        }
      }
      for (let sub of Object.keys(cdgrades[terms[i]])) {
        if (!(subs.includes(sub))) {
          subs.push(sub);
        }
      }
  }
  return cdgrades;
}

function makestudenttable(student){
  /*writes a table in the window with the student data in it.
  */
  mysubs = gettableheaders(student.grades);
  mysubs.unshift("Semester"); //Add semester

  d3.select("#bigtable").html("");

  d3.select("#bigtable")
  .append("table")
  .attr("id", "stutable")
  .append("tr")
  .attr("id", "tableheader")
  .selectAll("th")
  .data(mysubs).enter()
  .append("th")
  .text(function(d) {return d.concat("\t");});

  terms = Object.keys(student.grades).sort();

  // Make the table with grades and letters
  for (var i = 0; i < terms.length; i++) {
   d3.select("#stutable")
  .append("tr")
  .attr("id", "t".concat(terms[i])) //can't start ids with numbers
  .selectAll("td")
  .data(mysubs).enter()
  .append("td")
  .attr("class", function(d) {return "grade".concat(student.grades
    [terms[i]][d]);})
  .text(function(d) {
    if (d != "Semester") {
    return gradenumtolet(student.grades
    [terms[i]][d] , "\t");}
    else {return terms[i];}
  });

  //Write in merits
  termrow = d3.select("#t".concat(terms[i]));
  header = d3.select("#tableheader");

  for (let merithead of Object.keys(student.merits).sort(sortmeritorder)) {
    if (merithead != "mbysubject") {
      merit = student.merits[merithead][terms[i]];
      if (merithead != "tmerits") {
        merit = merit.toFixed(2);
      }
      termrow.append("td")
      .text(merit);
    }
  }
  }

  stutable = d3.select("#stutable");
  //Add in average merit row

    stutable.append("tr")
    .attr("id", "avrow")
    .selectAll("td")
    .data(mysubs)
    .enter()
    .append("td")
    .attr("class", function(d) {return "grade".concat(merittonum
      (getaveragesubjgrade(student.merits.mbysubject,d,1)));})
    .text(function(d) {return getaveragesubjgrade(
      student.merits.mbysubject,d);});

   //Add in average grade row

     stutable.append("tr")
     .selectAll("td")
     .data(mysubs)
     .enter()
     .append("td")
     .attr("class", function(d) {return "grade".concat(merittonum(
       getaveragesubjgrade(student.merits.mbysubject,d,1)));})
      .text(function(d) {return merittolet(
        getaveragesubjgrade(student.merits.mbysubject,d));});

  //Write headers for merit columns
  header.append("th").text("Merits");
  header.append("th").text("Av. Merits");
  header.append("th").text("Core Av.");
  header.append("th").text("Lang. Av.");
  header.append("th").text("Aes. Av.");
  header.append("th").text("SO Av.");
  header.append("th").text("NO Av.");
}

function getsemesters(classl, depth){
  //get all semesters from students in given classl
  //Error checking
  if (!["cohort","class"].includes(depth)){
    throw "incorrect depth in function 'getsemesters'";
  }
  var semesters = [];
  if (depth == "class"){
    for (let student of Object.keys(classl)){
      for (let semester of Object.keys(classl[student].grades)){
        if (!semesters.includes(semester)){
          semesters.push(semester);
        }
      }
    }
  }
  else {
    for (let group of Object.keys(classl)){
      for (let semester of getsemesters(classl[group], "class")){
        if (!semesters.includes(semester)){
          semesters.push(semester);
        }
      }
    }
  }
    return semesters.sort();
}

//Converts words in "Graph" settings box to headers in objects
var graphselectlookup = {"tmaverage" : ["Av. Merits",
                                            "Average Merits"],
                         "tmcoreaverage" : ["Core Av.",
                                            "Average Core Merits"],
                         "tmlangaverage" : ["Lang Av.",
                                            "Average Language Merits"],
                         "tmaesaverage" : ["Aes. Av.",
                                            "Average Aes. Merits"],
                         "tmsoaverage" : ["SO. Av.",
                                            "Average SO. Merits"],
                         "tmnoaverage" : ["NO. Av.",
                                            "Average NO. Merits"]};

function getscatterdata(student, datatype = "tmaverage"){
  data = [];
    for (var term of Object.keys(student
      .merits[datatype]).sort()) {
    data.push({"x" : term,
          "y" : student.merits
                        [datatype][term]});
  }
   return data;
}

function makescattergraph(student = currstudent){

  // Clear the svg object
  d3.select("#scatterplot").remove();

  //Catch odd error I don't understand:
  if (student == undefined){
    student =
  classl[d3.select("#classSelector").property("value")]
  [d3.select("#idSelector").property("value")];
  }

  var datatypes = [];
    //Loop through all checkboxes to get settings
  for (let checkbox of Object.keys(graphselectlookup)){
    if (d3.select("#cds".concat(checkbox)).property("checked") == true){
      datatypes.push(checkbox);
    }
  }

  //If no checkboxes are checked, check "Average Merits" and graph that
  if (datatypes.length == 0) {
    d3.select("#cdstmaverage").property("checked", "true");
    datatypes = ["tmaverage"];
  }

  var margin = {top : 30, right: 30, bottom:30, left:60},
      width = 360 - margin.left - margin.right,
      height = 300 - margin.top - margin.bottom;

  //Need to collect some data to graph axes
  var data = getscatterdata(student, datatypes[0]);

  // append the svg object to the correct div object
  var svg = d3.select("#scatterplotcontainer")
              .append("svg")
                .attr("id" , "scatterplot")
                .attr("class", "chart")
                .attr("width", width + margin.left + margin.right)
                .attr("height", height + margin.top + margin.bottom)
              .append("g")
                .attr("transform",
                      "translate(" + margin.left + "," + margin.top + ")");
      // Add X axis

      var x = d3.scaleBand()
                .domain(data.map(function(d) {return d.x;}))
                .range([0,width])
                .padding(1);
      svg.append("g")
         .attr("transform", "translate(0," + height + ")")
         .call(d3.axisBottom(x))
         .selectAll("text")
           .attr("transform", "translate(-10,0)rotate(-45)")
           .style("text-anchor", "end") ;

      // Add Y axis
      var y = d3.scaleLinear()
                .domain([0, 20])
                .range([ height, 0]);
      svg.append("g")
         .call(d3.axisLeft(y));

      //Add X axis label
      //svg.append("text")
      //   .attr("text-anchor", "end")
      //   .attr("x", width/2 + margin.left)
      //   .attr("y", height + margin.top + 20)
      //   .text("Term")

      //Add Y axis label
      svg.append("text")
         .attr("text-anchor", "end")
         .attr("transform", "rotate(-90)")
         .attr("y", -margin.left + 20)
         .attr("x", -margin.top - height/2 + 80)
         .text("Average Merits");

    //loop through selected graphs and plot them
    var counter = 0;
    do {
      currdata = datatypes[counter];
      currcolour = "var(--".concat(currdata,"-color)");
      // Add path
      svg.append("path")
        .datum(data)
        .attr("fill", "none")
        .attr("style", "stroke:".concat(currcolour))
        .attr("stroke.width", 2)
        .attr("d", d3.line()
          .x(function(d) {return x(d.x);})
          .y(function(d) {return y(d.y);})
          );

      // Add dots
      svg.append("g")
         .selectAll("dot")
         .data(data)
         .enter()
         .append("circle")
           .attr("cx", function (d) {return x(d.x);})
           .attr("cy", function (d) {return y(d.y);})
           .attr("r", 3)
           .attr("style", "fill:".concat(currcolour));

      // Add labels
      if (d3.select("#dotvaluessel").property("checked") == true) {
        svg.append("g")
           .selectAll("text")
           .data(data)
           .enter()
           .append("text")
             .attr("transform", function(d)
                      {return `translate(${x(d.x)},${y(d.y)})`;})
             .attr("dy", "1em")
             .attr("dx", "-1em")
             .text(function(d) {return d.y.toFixed(2);});
        }
    counter += 1;
    data = getscatterdata(student, datatypes[counter]);
    }
    while (counter < datatypes.length);

        //Make title
        if (d3.select("#charttitlesel").property("checked") == true) {
          svg.append("g")
             .append("text")
             .attr("id", "charttitle")
             .style("text-anchor", "middle")
             .attr("x", width/2)
             .attr("y", -5)
             .text(d3.select("#studentSelector").property("value"));
        }
}

function makegradebarchart(data, 
                          container="#barchartcontainer", 
                          chartname="#barchart"){
  //Takes an array of grade counts in form {x:count, y:"letter"} the order
  //[A,B,C,D,E,F,M,-] and makes a bar chart of them called chartname in
  //container

  //Remove any previous chart
  d3.select(chartname).remove();

  //Make bar chart
  var margin = {top : 30, right: 30, bottom:30, left:60},
    width = 360 - margin.left - margin.right,
    height = 300 - margin.top - margin.bottom;

  var svg = d3.select(container)
              .append("svg")
                .attr("id" , "barchart")
                .attr("class", "chart")
                .attr("width", width + margin.left + margin.right)
                .attr("height", height + margin.top + margin.bottom)
              .append("g")
                .attr("transform",
                      "translate(" + margin.left + "," + margin.top + ")");

      // Make x axis
       var x = d3.scaleBand()
                .domain(data.map(function(d) {return d.x;}))
                .range([0,width])
                .padding(0.2);
        svg.append("g")
         .attr("id", "xaxis".concat(container.substr(1)))
         .attr("transform", "translate(0," + height + ")")
         .call(d3.axisBottom(x))
         .selectAll("text")
           .style("text-anchor", "end");


      // Add y axis
         var maxval = d3.max(data, function(d) {return d.y;});
         var ticks = 0;
      // Make sensible number of ticks
        if (maxval > 20){
          ticks = 20;
        } else {
          ticks = maxval - 1;
        }


         var y = d3.scaleLinear()
                .domain([0,maxval])
                .range([height, 0]);
        svg.append("g")
         .attr("id", "yaxis".concat(container.substr(1)))
         .call(d3.axisLeft(y).tickFormat(d3.format("d")).ticks(ticks));
      // Add bars
        svg.selectAll("mybar")
          .data(data)
        .enter()
        .append("rect")
          .style("fill", function(d) {return "var(--grade"
            .concat(gradelettonum(d.x),"-color)");})
          .attr("x", function(d) { return x(d.x); })
          .attr("width", x.bandwidth())
          .attr("y", function(d) { return y(d.y); })
          .attr("height", function(d) { return height - y(d.y); });

        //Format axes
        d3.select("#xaxis".concat(container.substr(1)))
          .attr("font-family", "Open Sans").attr("font-weight", "bold");
        d3.select("#yaxis".concat(container.substr(1)))
          .attr("font-family", "Open Sans").attr("font-weight", "bold");


}

function makestudentbargraph(student = currstudent){
  var gradecounts = [0,0,0,0,0,0,0,0,0];
  var thisyear = Object.keys(student.grades)
    .sort()[Object.keys(student.grades).length - 1];
    for (let subj of Object.keys(student.grades[thisyear])){
      if(!notsubjects.includes(subj)){
        gradecounts[student.grades[thisyear][subj]] += 1;
      }
    }

    var data = [];
    for (var i of [5,4,3,2,1,6,7,8]){ //Grades are in a stupid order in schoolsoft
      data.push({"x":gradenumtolet(i),"y":gradecounts[i]});
    }
    makegradebarchart(data);
}

function makeybarchartsettings(classl, depth){
  if (!["bar","stack"].includes(sessionStorage.yBarChartType)){
    sessionStorage.yBarChartType = "bar";
  }
  var elementchoice = 0;
  d3.select("#ybarchartsettings").html("");
  d3.select("#ybarchartsettings").attr("hidden", null);
  d3.select("#ybarchartsettings").append("table")
  .attr("class", "tabs")
  .html(
          "<tr><td id = 'ybc0' onclick = selectybarchartsetting('bar')".concat(
          ">Show Grades Per Semester</td><td id = 'ybc1'",
          " onclick=selectybarchartsetting('stack')",
          ">Show Distribution Over Time</td></tr>"));
  if (sessionStorage.yBarChartType == "bar"){
    d3.select("#ybarchartsettings").append("select")
                                   .attr("id","ychartsemesterselect");
    var semesters = getsemesters(classl,depth);
    semesters.reverse();
    for (let semester of semesters){
      d3.select("#ychartsemesterselect").append("option")
                                      .text(semester);
    }
    d3.select("#ychartsemesterselect").on("change",selectybarchartyear);

  } else {
    elementchoice = 1;
  }
  mybsselected = document.getElementById("ybc".concat(elementchoice));
  mybsselected.className = "tabselected";
}

function selectybarchartsetting(opt){
  //pick a different type of year bar chart. Change the variable, redraw the
  //page
  if (["bar","stack"].includes(opt)){
  sessionStorage.yBarChartType = opt;
  selectnewyearclass();
  } else {
  throw "Invalid bar chart in 'selectybarchartsetting'";
  }
}

function selectybarchartyear(){
  var theyear = d3.select("#yearSelector").property("value");
  var semester = d3.select("#ychartsemesterselect").property("value");
  if (document.getElementById("classSelector").selectedIndex == 0) {
    //Do for whole year group
    var minicohort = {};
    for (let group of Object.keys(classl)){
      if (group.charAt(0) == theyear){
        minicohort[group] = classl[group];
     }
    }
    makegradebarchart(getsummarygradecount(minicohort,"cohort",semester));

  } else {
    var theclass = d3.select("#classSelector").property("value");
    makegradebarchart(getsummarygradecount(classl[theclass],"class", semester));
  }
}

function makestackedgradebarchart(data){
  d3.select("#barchart").remove();
  series = d3.stack().keys(["-","M","F","E","D","C","B","A"])(data);

  var margin = {top : 30, right: 30, bottom:30, left:60},
    width = 360 - margin.left - margin.right,
    height = 300 - margin.top - margin.bottom;

  var svg = d3.select("#barchartcontainer")
              .append("svg")
                .attr("id" , "barchart")
                .attr("class", "chart")
                .attr("width", width + margin.left + margin.right)
                .attr("height", height + margin.top + margin.bottom)
              .append("g")
                .attr("transform",
                      "translate(" + margin.left + "," + margin.top + ")");

  //Make x axis
  var x = d3.scaleBand()
            .domain(data.map(function(d) {return d.semester;}))
                .range([0,width])
                .padding(0.2);

        svg.append("g")
         .attr("transform", "translate(0," + height + ")")
         .call(d3.axisBottom(x))
         .selectAll("text")
           .style("text-anchor", "end");

  //Make y axis
  var ymax = d3.max(series, d => d3.max(d, d => d[1]));
  var y = d3.scaleLinear()
    .domain([0, ymax])
    .range([height, 0]);

  var ticks = d3.min([ymax,20]);

  svg.append("g")
        .call(d3.axisLeft(y).tickFormat(d3.format("d")).ticks(ticks));

  svg.append("g")
    .selectAll("g")
    .data(series)
    .join("g")
      .attr("fill", function(d) {return "var(--grade"
            .concat(gradelettonum(d.key),"-color)");})
    .selectAll("rect")
    .data(d => d)
    .join("rect")
      .attr("x", (d, i) => x(d.data.semester))
      .attr("y", d => y(d[1]))
      .attr("height", d => y(d[0]) - y(d[1]))
      .attr("width", x.bandwidth());
}

function getstackedgrades(classl,depth, subject = null){
  //Error checking
  if (!["cohort","class"].includes(depth)){
    throw "incorrect depth in function 'getstackedgrades'";
  }
  var currobj = {};
  var ret = [];
  var total = 0;
  var semesters = getsemesters(classl, depth);
  for (let semester of semesters){
    currentobj = {"semester": semester};
    for (let obj of getsummarygradecount(classl, depth, semester, subject)){
      currentobj[obj.x] = obj.y;
      total += obj.y;
    }
    currentobj.total = total;
    ret.push(JSON.parse(JSON.stringify(currentobj)));
    total = 0;
  }
  return ret;
}

function getsummarygradecount(classl, depth, semester = null, subject = null){
  var data = [];
  //Error checking
  if (!["cohort","class"].includes(depth)){
    throw "incorrect depth in function 'getsummarygradecount'";
  }
  var gradecounts = [0,0,0,0,0,0,0,0,0];
  if (depth == "class"){
  var currsemester = "";
  var semestercheck = false;
  if (semester == null){
    semestercheck = true;
  } else {
    currsemester = semester;
  }
    for (let student of Object.keys(classl)){
      var semesters = Object.keys(classl[student].grades).sort();
      if (semestercheck == true){
        currsemester = semesters[semesters.length - 1];
      }
      if (semesters.includes(currsemester)){ //Only return grades if the student has grades for listed semester
        for (let subj of Object.keys(classl[student].grades[currsemester])){
          if ((subject == null || subj == subject) && !notsubjects.includes(subj)){
            //If either the subject is the selected one or there is no selected subject AND it's a real subject
            gradecounts[classl[student].grades[currsemester][subj]] += 1;
          }
        }
      }
    }
    for (var i of [5,4,3,2,1,6,7,8]){ //Grades are in a stupid order in schoolsoft
      data.push({"x":gradenumtolet(i),"y":gradecounts[i]});
    }
  } else {
    for (let group of Object.keys(classl)){
      var yearcount = getsummarygradecount(classl[group], "class", semester, subject);
      for (var j=0; j < yearcount.length; j++){
        gradecounts[j] += yearcount[j].y;
      }
    }
    var gradelist = [5,4,3,2,1,6,7,8];
    for (var i=0; i < gradecounts.length; i++){
      data.push({"x":gradenumtolet(gradelist[i]),"y":gradecounts[i]});
    }
  }
  return data;
}

function makeadvanced(student = currstudent){
  var linav = student.advanced.linav;
  var leastres = student.advanced.leastres;
  d3.select("#advancedinfo")
    .html("<b>Slope:</b> "
    .concat(linav.toFixed(2),
      " (What does this mean? - The number reflects change. Positive numbers mean grades are increasing, negative means decreasing. Bigger numbers mean bigger changes.)"));
  d3.select("#advancedinfo").append("p")
    .html("<b>Mean residue:</b> "
    .concat(leastres[0].toFixed(2),
      " (What does this mean? - This number reflects how accurate the slope is. The larger it is, the 'weirder' the data, and the less consistently the student's grade has changed.)"));
  d3.select("#advancedinfo").append("p")
    .html("<b>Max residue:</b> "
    .concat(leastres[1].toFixed(2),
      " (What does this mean? - Compare this number to the mean residue. If they are similar, all of the student's grades are equally 'weird'. If they are different, only some of the grades are suspect. This should be investigated.)"));
}

function advstats(student){
  cleandata = getscatterdata(student);
    cleandata = getscatterdata(student);
  for (i=0;i < cleandata.length;i++){
    cleandata[i].x = i;
  }

  var linav = linreg(cleandata);
  var leastres = meanmaxleastres(cleandata, linav);
  return {"linav" : linav[0],
            "leastres" : leastres};
}

function selecttoptab(tabname){
  var tabs = ["#studenttab","#ygtab","#subjtab","#teachtab","#sumtab"];
  if (!tabs.includes(tabname)){
    throw "Not valid tab in selecttoptab.";
  }
  for (let currtab of tabs){
    if (tabname === currtab){
      d3.select(currtab).attr("class","tabselected");
    }else
      d3.select(currtab).classed("tabselected", false);
  }
}

function makeclassl(){
  //Get list of students in each class and write to classl
  //in the form above
  //Also write subjects to subject

  students.then(function (result) { //Get initial information
    var studentl = []; //Cludge to prevent having to compare arrays
    Promise.all(result.map(function(row){
        //Sanitize Data
      if (row.gradeclass == "-"){
        row.gradeclass = row.class;
      }
      if (!subjects.includes(row.gradesubject)){
        subjects.push(row.gradesubject);
      }
      if (row.fname != undefined) {
        if (row["class"] in classl){
          if (!studentl.includes(row.studentid) || !Object.keys(classl[row.class]).includes(row.studentid)) { //If the student is new
            makestudent(classl,row);
            studentl.push(row.studentid);
          }
          else{
            addgradetostudent(classl[row["class"]],row);
          }
        }else{
            makeclass(classl,row);
            makestudent(classl,row);
          studentl.push(row.studentid);
        }
        return 1;
      }
    }));
    return 1;
  }).then(function(classes) { //Process classl
    for (let sclass of Object.keys(classl)) {
      for (let student of Object.keys(classl[sclass])) {
        var cstudent = classl[sclass][student];

        //Copy grades missing in VT to HT
        //There is surely some better way to do this?
        cstudent.grades =
          filldownVTgrades(cstudent.grades);
        //Add merit average to student
        cstudent.merits = termmerits(cstudent.grades);
        cstudent.advanced = advstats(cstudent);
      }
    }
  });
  subjects = subjects.sort(sortsubjectorder);
  return classl;
}

function makestudents() {
  //Clear contents div
  contents.html("");
  selecttoptab("#studenttab");

  checkclassl.then(function() { //Generate page elements
    var selectenv = d3.select("#sscontent")
      .append("div")
      .attr("id", "selectors");
    d3.select("#sscontent").append("div").attr("id", "datasettings");

    d3.select("#sscontent").append("div").attr("id", "bigtable");
    d3.select("#sscontent").append("div").attr("id", "charts");
    d3.select("#charts").append("div").attr("id","scatterplotcontainer");
    d3.select("#charts").append("div").attr("id","barchartcontainer");
    d3.select("#charts").append("div").attr("id","schartsettings")
      .attr("hidden", "true");
    d3.select("#sscontent").append("div").attr("id","advancedinfo");

    var classSelect = d3.select("#selectors")
      .append("select")
      .attr("id", "classSelector")
      .selectAll("option")
      .data(["Select a class"].concat(Object.keys(classl).sort())).enter()
      .append("option")
      .text(function(d) {return d;});
    d3.select("#classSelector").on("change", selectnewclass);

    var studentSelect = d3.select("#selectors")
      .append("select")
      .attr("id", "studentSelector")
      .selectAll("option")
      .data(["Select a student"]).enter()
      .append("option")
      .text(function(d) {return d;});
    d3.select("#studentSelector").on("change", selectnewstudent);

    var keepid = d3.select("#selectors")
      .append("select")
      .attr("id", "idSelector")
      .attr("hidden", "true")
      .append("option")
      .text("");

    var pulldowndata = d3.select("#datasettings").append("input")
    .attr("id", "cdselect")
    .attr("type", "checkbox");
    if (localStorage.carryDown == 1){
      pulldowndata.attr("checked", true);
    } else {}

    d3.select("#cdselect").on("change", selectnewstudent);
    d3.select("#datasettings").append("text").text("Carry down grades");


    //Make chart settings pane
    csettings = d3.select("#schartsettings");
    csettings.append("h3").text("Chart Settings");
    csettingstable = csettings.append("table").attr("id", "csettingst");
    csettingstable
      .html("<tr><td><input type = 'checkbox' id='dotvaluessel'></td>"
      .concat("<td>Show values under dots</td></tr>",
            "<tr><td><input type = 'checkbox' id='charttitlesel' checked></td>",
            "<td>Display chart title</td></tr>"));

    d3.select("#dotvaluessel").attr("onclick", "makescattergraph()");
    d3.select("#charttitlesel").attr("onclick", "makescattergraph()");


    var chartopts = Object.keys(graphselectlookup);
    // Make table of different possible lines on charts
    // By default, select "Average Merits"
    csettings.append("table")
             .attr("id","chartdatashow")
             .selectAll("tr")
             .data(chartopts)
             .enter()
             .append("tr")
               //There is surely a better way to do this,
               //but maybe not using d3?
             .html(function(d) {return "<td><input id='cds".concat(d,
                                 "' type='checkbox'></td><td>",
                                 graphselectlookup[d][1],
                                 "&nbsp;</td><td><span style='font-weight: ",
                                 "bold; color: var(--",d,"-color)'>&mdash;",
                                 "</span></td>");}); 
      for (let button of chartopts){
        d3.select("#cds".concat(button)).attr("onclick", "makescattergraph()");
      }
     d3.select("#cdstmaverage").property("checked", "true");


  }).catch(console.log.bind(console));

  console.log(classl);
}

function makeyearl(classl){
  //Make year groups
  var done = [];
  for (let item of Object.keys(classl)){
    if (!done.includes(item.slice(0,1))){
      yearl[item.slice(0,1)] = {};
      yearl[item.slice(0,1)][item] = {"summary" : {}};
      yearl[item.slice(0,1)].summary = {};
      done.push(item.slice(0,1));

    }
    else {
      yearl[item.slice(0,1)][item] = {"summary" : {}};
    }
  }
  //Calculate data for year group object
  getyearaverages(classl,yearl);
  console.log(yearl);
}

function makeyearlCarry(classl){
  //Take a classl object. Carry down all of the grades, then generate
  //a yearl object
  count = 0;
  classlcopy = JSON.parse(JSON.stringify(classl));
  for (let group of Object.keys(classlcopy)){
    for (let student of Object.keys(classlcopy[group])){
      classlcopy[group][student].grades = carrydowngrades(classl[group][student].grades);
      count += 1;
      }
  }
  makeyearl(classlcopy);
}

function makecarriedyear(){
  //check carryDown. Then make correct yearl
    if (localStorage.carryDown == 0){
    makeyearl(classl);
  } else {
    makeyearlCarry(classl);
  }
}

function makeyeargroup(){
  contents.html("");
  selecttoptab("#ygtab");
  var yeardatasetting = 0;

  makecarriedyear();

  //Make year selector
  var selectenv = d3.select("#sscontent")
      .append("div")
      .attr("id", "selectors")
      .append("select")
      .attr("id", "yearSelector");
  d3.select("#yearSelector")
      .append("option")
      .text("Select Year Group");
  for (let item of Object.keys(yearl)){
  d3.select("#yearSelector")
    .append("option")
    .text(item);
  }
  d3.select("#yearSelector").on("change", selectnewyear);
  //Make class selector
  d3.select("#selectors")
    .append("select")
    .attr("id", "classSelector")
    .append("option")
    .text("Select Class");

  //Add divs for other elements
    d3.select("#sscontent").append("div").attr("id", "datasettings");

    d3.select("#sscontent").append("div").attr("id", "bigtable");
    d3.select("#sscontent").append("div").attr("id", "charts");
    d3.select("#charts").append("div").attr("id","barchartcontainer");
    d3.select("#barchartcontainer").append("div").attr("id","ybarchartsettings")
                                   .attr("hidden","true");
    d3.select("#sscontent").append("div").attr("id","advancedinfo");

    //Make pull down grades option
    var pulldowndata = d3.select("#datasettings").append("input")
    .attr("id", "cdselect")
    .attr("type", "checkbox");  
    d3.select("#datasettings").append("text").text("Carry down grades");
    if (localStorage.carryDown == 1){
      pulldowndata.attr("checked", true);
    } else {}
    d3.select("#cdselect").on("change", function(){
      if (d3.select("#cdselect").property("checked") == true){
        localStorage.carryDown = 1;
      } else {
        localStorage.carryDown = 0;
      }
      makecarriedyear();
      selectnewyearclass();});
}

function selectyeardatasetting(val){
  var theyear = d3.select("#yearSelector").property("value");
  var curyear = yearl[theyear];
  sessionStorage.yTableDisplay = val;
  selectnewyearclass();
}

function getclasssubs(curclass){
  var subjs = [];
  for (let semester of Object.keys(curclass)) {
        if (semester != "summary") {
          for (let subject of Object.keys(curclass[semester].average)){
            if (!subjs.includes(subject)){
              subjs.push(subject);
            }
          }
        }
      }
  subjs.sort(sortsubjectorder);
  return subjs;
}

function getyearsubs(curyear){
  var subjs = [];
  for (let mgroup of Object.keys(curyear)){
    if (mgroup != "summmary") {
      for (let semester of Object.keys(curyear[mgroup])) {
        if (semester != "summary") {
          for (let subject of Object.keys(curyear[mgroup][semester].average)){
            if (!subjs.includes(subject)){
              subjs.push(subject);
            }
          }
        }
      }
    }
  }
  subjs.sort(sortsubjectorder);
  return subjs;
}

function selectnewyear(){
  //Change carryDown variable to reflect checkbox
  if (document.getElementById("yearSelector").selectedIndex == 0) {
    clearpage();
  } else {
    clearpage();
  var theyear = d3.select("#yearSelector").property("value");
  var curyear = yearl[theyear];
  //Add classes to class selector
  d3.select("#classSelector")
    .selectAll("option")
    .remove();

  d3.select("#classSelector")
    .append("option")
    .text("Year Summary");

  for (let item of Object.keys(curyear).sort()){
    if (item != "summary"){
  d3.select("#classSelector") 
    .append("option")
    .text(item);
    }
  }
  d3.select("#classSelector").on("change", selectnewyearclass);
  makeyeartable(curyear);

  var minicohort = {};
  for (let group of Object.keys(classl)){
    if (group.charAt(0) == theyear){
      minicohort[group] = classl[group];
    }
  }
  makeybarchartsettings(minicohort,"cohort");
  if (sessionStorage.yBarChartType == "stack"){
    makestackedgradebarchart(getstackedgrades(minicohort,"cohort"));
  } else {
  makegradebarchart(getsummarygradecount(minicohort,"cohort"));
  }

  }
}

function selectnewyearclass(){
  if (document.getElementById("classSelector").selectedIndex == 0) {
    selectnewyear();
  } else {
    clearpage();
  var theyear = d3.select("#yearSelector").property("value");
  var theclass = d3.select("#classSelector").property("value");
  var curclass = yearl[theyear][theclass];
  makeclasstable(curclass);
  var failings = getfailingstudents(classl[theclass],"class");
  d3.select("#bigtable").append("table").attr("id","failing");
  d3.select("#failing").append("th").text("Students currently failing a subject").attr("colspan","2");
  d3.select("#failing")
    .selectAll("tr")
    .data(Object.keys(failings).sort()).enter()
    .append("tr")
    .html(function(d) {return "<tr><td>".concat(d, 
                              "</td><td>", 
                              Object.keys(failings[d]).slice(1), 
                              "</td></tr>");});
    //FIX THIS AGAINST INJECTION
  makeybarchartsettings(classl[theclass],"class");
  if (sessionStorage.yBarChartType == "stack"){
    makestackedgradebarchart(getstackedgrades(classl[theclass],"class"));
  } else {
  makegradebarchart(getsummarygradecount(classl[theclass],"class"));
  }
  
  }
}

function teacheraddgrade(teacher, grade){
  //Takes a teacher and a grade and addes the grade to the correct place
  //In the teacher object

  var gradeyear = grade.archiveid.concat(grade.term);
  //Make year if not there
  if (!Object.keys(teacher).includes(gradeyear)){
    teacher[gradeyear] = {};
  }


  var gradeclass = grade.gradeclass;

  //Make Class if not there
  if (!Object.keys(teacher[gradeyear]).includes(gradeclass)){
    teacher[gradeyear][gradeclass] = {};
  }

  var gradesubj = grade.gradesubject;

  //Make subject in class if not there
  if (!Object.keys(teacher[gradeyear][gradeclass]).includes(gradesubj)){
    teacher[gradeyear][gradeclass][gradesubj] = {};
  }

  //Fetch previous grade in subject if exists.
  //REQUIRES THAT classl HAS BEEN GENERATED
  //(Currently can't find carried grades)
  var lastsemester = semesterbefore(classl[grade.class][grade.studentid].grades, 
    gradeyear);

  if (lastsemester!= false) {
    var lastgrade = classl[grade.class][grade.studentid]
                      .grades[lastsemester][gradesubj];
  }else{
    var lastgrade = "";
  }

  teacher[gradeyear][gradeclass][gradesubj][grade.studentid] = {
    "fname" : grade.fname,
    "lname" : grade.lname,
    "grade" : grade.gradeid,
    "spec"  : grade.specialization,
    "prevgrade" : lastgrade,
  };
}

function toggleshowonlyrecent(){
  if (sessionStorage.tShowAllTeachers == 0){
    sessionStorage.tShowAllTeachers = 1;
  } else {
    sessionStorage.tShowAllTeachers = 0;
  }
  maketeacher();
}

function generateteacherl(){
  teachers = [];
    students.then(function (result) {
    result.map(function(row){
      if (row.teacher.includes(", ")){
        var rowteachers = row.teacher.split(", ");
      }
      else {
        var rowteachers = [row.teacher];
      } 
      for (let teacher of rowteachers){
          if (teacher == "" || teacher == "-"){
            teacher = "NO NAME";
          }
        if (!teachers.includes(teacher)){
          teachers.push(teacher);
          teacherl[teacher] = {};
        }
        teacheraddgrade(teacherl[teacher],row);
      }
          }); 
  });
}

function maketeacher(){
  //Promise to generate a teacherl
  const checkteacher = new Promise(function(resolve, reject){
      if (teacherl != {}){
    generateteacherl();
    }
    resolve("1");
  });
  contents.html("");
  selecttoptab("#teachtab");

  checkteacher.then(function(){
    //Make page
    var selectenv = d3.select("#sscontent")
      .append("div")
      .attr("id", "selectors");
    //Make teacher selector
    var teacherlist = [];
    if (sessionStorage.tShowAllTeachers != 1){
      sessionStorage.tShowAllTeachers = 0;
      for (let teacher of Object.keys(teacherl).sort()){
        if (Object.keys(teacherl[teacher]).sort().reverse()[0] === mostrecentsemester){
          teacherlist.push(teacher);
        }
      }
    } else {
      teacherlist = Object.keys(teacherl).sort();
    }
    var teacherSelect = d3.select("#selectors")
      .append("select")
      .attr("id", "teacherSelector")
      .selectAll("option")
      .data(["Select a Teacher"].concat(teacherlist)).enter()
      .append("option")
      .text(function(d) {return d;});
    d3.select("#teacherSelector").on("change", selectnewteacher);
    var teachersemselect = d3.select("#selectors")
      .append("select")
      .attr("id", "teacherTermSelector")
      .append("option")
      .text("Select a Semester");
    d3.select("#teacherTermSelector").on("change", selectnewteachersemester);
    d3.select("#selectors")
      .append("input")
      .attr("id", "tShowOnlyRecent")
      .attr("type","checkbox");
    if (sessionStorage.tShowAllTeachers != 1){
      d3.select("#tShowOnlyRecent").attr("checked", true);
    }
    d3.select("#selectors")
      .append("span")
      .text("Show only teachers who gave grades in ".concat(mostrecentsemester));
    d3.select("#tShowOnlyRecent").on("change", toggleshowonlyrecent);

    d3.select("#sscontent")
      .append("div")
      .attr("id", "teachersummary");

    d3.select("#sscontent")
      .append("div")
      .attr("id","bigtable");

    console.log(teacherl);
  });
}

function selectnewteacher(){
  if (document.getElementById("teacherSelector").selectedIndex == 0) {

  } else {
    clearpage();
  var theteacher = d3.select("#teacherSelector").property("value");
  teachersems = Object.keys(teacherl[theteacher]).sort().reverse();
  //Kludge to fix d3 weirdness
  teachersems.unshift("Select a Semester");
  d3.select("#teacherTermSelector")
    .selectAll("option")
    .remove();
  d3.select("#teacherTermSelector")
    .selectAll("option")
    .data(teachersems).enter()
    .append("option")
    .text(function(d){ return d;});
  document.getElementById("teacherTermSelector").selectedIndex = 1;
  selectnewteachersemester();
  }
}

function selectnewteachersemester(){
  if (document.getElementById("teacherTermSelector").selectedIndex == 0){
    clearpage();
  } else {
    clearpage();
  var theteacher = d3.select("#teacherSelector").property("value");
  var theyear = d3.select("#teacherTermSelector").property("value");
  d3.select("#bigtable")
    .append("div")
    .attr("id", "teacherclassholder");
  maketeachersummarybox(theteacher, teacherl, theyear);
  for (let group of Object.keys(teacherl[theteacher][theyear])){
    d3.select("#teacherclassholder").append("hr");
    d3.select("#teacherclassholder").append("h3").attr("class", "tclasstitle").text(group);
    for (let subject of Object.keys(teacherl[theteacher][theyear][group])){
      maketeacherclasstable(theteacher,classl,theyear,group,subject);
    }
  }
  }
}

function maketeacherclasstable(teacher, classl, year, group, subj){
  //Takes teacher object classl and group and appends a table to "bigtable"
  var divid = "t".concat(teacher,year,group,subj).replace(/[^A-Za-z0-9]/, "");
  divid = divid.replace(/[^A-Za-z0-9]/, ""); //Doesn't work if I only do it once. Who knows why...
  d3.select("#teacherclassholder")
    .append("div")
    .attr("id",divid);


  d3.select("#".concat(divid))
    .append("span")
    .attr("class", "tsubjtitle")
    .text(subj);


  d3.select("#".concat(divid))
    .append("div")
    .attr("id","g".concat(divid))
    .append("div")
    .attr("id","g".concat(divid,"grades"))
    .attr("class", "tgradeholder")
    .selectAll("div")
    .data(Object.keys(teacherl[teacher][year][group][subj])).enter()
    .append("div")
    .attr("class", "gradebox")
    .html(function(d){
      //Build grade box
      var outstring = "<div class='gradelettercircle grade"
        .concat(teacherl[teacher][year][group][subj][d].grade);
      outstring = outstring.concat("border'>", 
        gradenumtolet(teacherl[teacher][year][group][subj][d].grade),
        "</div> <div class='gradechangecircle ");
      var gradechange = gradechangeamount(teacherl[teacher][year][group][subj][d].prevgrade,
          teacherl[teacher][year][group][subj][d].grade);
      if (gradechange > 0){
        outstring = outstring.concat("gradechangeupborder");
      } else if (gradechange < 0){
        outstring = outstring.concat("gradechangedownborder");
      } else {
        outstring = outstring.concat("nogradechangeborder");
      }
      outstring = outstring.concat("'>", gradechange, 
        "</div><span class='gradeboxStudentName'>",
        teacherl[teacher][year][group][subj][d].fname,
        " ", teacherl[teacher][year][group][subj][d].lname, 
        "</span>"
        );


      return outstring;

      /*teacherl[teacher][year][group][subj][d].fname.concat(
        " ",  
        teacherl[teacher][year][group][subj][d].lname, "<br/><span class='tgradebig'>", 
        gradenumtolet(teacherl[teacher][year][group][subj][d].grade),
        "</span><br/><span class='tgradesmall'>", gradenumtolet(teacherl[teacher][year][group][subj][d].prevgrade),
        " <br/>(change: ", 
        gradechangeamount(teacherl[teacher][year][group][subj][d].prevgrade,
          teacherl[teacher][year][group][subj][d].grade), ")</span>");
          // */
    } //FIX AGAINST INJECTION

    );
  //Make bar chart container
  d3.select("#g".concat(divid))
    .append("div")
    .attr("id", "g".concat(divid,"graphholder"))
    .attr("class", "tclasschartholder");
  //Count grades
  var gradecount = [0,0,0,0,0,0,0,0,0];
  for (let student of Object.keys(teacherl[teacher][year][group][subj])){
    gradecount[teacherl[teacher][year][group][subj][student].grade] += 1;
  }
  var gradedata = [];
  for (let i of [5,4,3,2,1,6,7,8]){
    gradedata.push({"y" : gradecount[i], "x": gradenumtolet(i)});
  }
  makegradebarchart(gradedata, "#g".concat(divid,"graphholder"), "#g".concat(divid,"graph"));
}

function getsummaryboxstats(teacherl, 
  teacher, 
  semester, 
  group, 
  subj, 
  student, 
  gradescount,
  currgradesarray,
  gradechangearray,
  bigchanges,
  currfail,
  nowpassing){
  if (!["7","8"].includes(teacherl[teacher][semester][group][subj][student].grade)){
    currgradesarray.push(teacherl[teacher][semester][group][subj][student].grade%6);
  }
  gradescount[teacherl[teacher][semester][group][subj][student].grade] += 1;
  //Get list of grades changed
  if (!isNaN(teacherl[teacher][semester][group][subj][student].prevgrade)
    &&  !["7","8",""].includes(teacherl[teacher][semester][group][subj][student].prevgrade)
    &&  !["7","8",""].includes(teacherl[teacher][semester][group][subj][student].grade))
    {
      gradechangearray.push(teacherl[teacher][semester][group][subj][student].grade%6 - 
      teacherl[teacher][semester][group][subj][student].prevgrade%6);
      //Get list of grades changed by more than 2
      if (Math.abs(teacherl[teacher][semester][group][subj][student].grade%6 - 
         teacherl[teacher][semester][group][subj][student].prevgrade%6) > 2){

          bigchanges.push({
            "class": group,
            "subject": subj,
            "fname": teacherl[teacher][semester][group][subj][student].fname,
            "lname": teacherl[teacher][semester][group][subj][student].lname,
            "grade": teacherl[teacher][semester][group][subj][student].grade,
            "prevgrade": teacherl[teacher][semester][group][subj][student].prevgrade
          });
      }
    }
    //Get list of students currently failing
    if (teacherl[teacher][semester][group][subj][student].grade == 6){
      currfail.push({              
        "class": group,
        "subject": subj,
        "fname": teacherl[teacher][semester][group][subj][student].fname,
        "lname": teacherl[teacher][semester][group][subj][student].lname,});
    }

    //Get list of students who were failing and are now passing
    if ([7,8,6,0].includes(teacherl[teacher][semester][group][subj][student].prevgrade) &&
      ["1","2","3","4","5"].includes(teacherl[teacher][semester][group][subj][student].grade)){
      nowpassing.push({
        "class": group,
        "subject": subj,
        "fname": teacherl[teacher][semester][group][subj][student].fname,
        "lname": teacherl[teacher][semester][group][subj][student].lname,
        "grade": teacherl[teacher][semester][group][subj][student].grade,
      });
  }
}

function writesummarybox(gradescount, 
  currgradesarray, 
  gradechangearray,
  bigchanges,
  currfail,
  nowpassing){
  var gradesdata = [];
  for (let d of [5,4,3,2,1,6,7,8]){
    gradesdata.push({
      "y" : gradescount[d],
      "x" : gradenumtolet(d)
    });
  }
  var currmedian = median(currgradesarray);
  var changemean = gradechangearray.reduce((a,b) => a+b, 0)/gradechangearray.length;
  var sumbox = d3.select("#teachersummary");

  sumbox.append("div")
        .attr("id", "teachersummaryavgs")
        .html("Median Grade: <b>".concat(gradenumtolet(currmedian), "</b><br/>",
              "Mean grade change: <b>", changemean.toFixed(2), "</b>"));
  sumbox.append("div")
        .attr("id", "teacherbiggradechanges")
        .html("<span onclick=teachersumtabletoggle('#tbgcarr','#tgradechangetable')>Grades changed by more than 2: <b>".concat(
          bigchanges.length,"</b> <span id='tbgcarr'>&#9660;</span></span>"));
  d3.select("#teacherbiggradechanges")
        .append("table")
        .attr("id", "tgradechangetable")
        .attr("hidden", true)
        .selectAll("tr")
        .data(bigchanges).enter()
        .append("tr")
        .each(function(d){
          d3.select(this)
          .selectAll("td")
          .data(["subject","class","fname","lname","grade","prevgrade"]).enter()
          .append("td")
          .text(function(f){
            if (f === "grade"){
              return "".concat(gradenumtolet(d[f]),"←");
            } else if (f === "prevgrade"){
              return gradenumtolet(d[f]);
            } else {
            return d[f];
            }
          });
        });
  sumbox.append("div")
        .attr("id", "teacherstudentsfailing")
        .html("<span onclick=teachersumtabletoggle('#tsfarr','#tstudentfailingtable')>Students failing: <b>".concat(
          currfail.length,"</b> <span id='tsfarr'>&#9660;</span></span>"));
  d3.select("#teacherstudentsfailing")
        .append("table")
        .attr("id", "tstudentfailingtable")
        .attr("hidden", true)
        .selectAll("tr")
        .data(currfail).enter()
        .append("tr")
        .each(
          function(d){
          d3.select(this)
          .selectAll("td")
          .data(["subject","class","fname","lname"]).enter()
          .append("td")
          .text(function(f){
            return d[f];
          });
        });
  sumbox.append("div")
        .attr("id", "teachernowpassing")
        .html("<span onclick=teachersumtabletoggle('#tnparr','#tstudentpassingtable')>Students newly passing: <b>".concat(
          nowpassing.length,"</b> <span id='tnparr'>&#9660;</span></span>"));
  d3.select("#teachernowpassing")
        .append("table")
        .attr("id", "tstudentpassingtable")
        .attr("hidden", true)
        .selectAll("tr")
        .data(nowpassing).enter()
        .append("tr")
        .each(
          function(d){
          d3.select(this)
          .selectAll("td")
          .data(["subject","class","fname","lname","grade"]).enter()
          .append("td")
          .text(function(f){
            if (f == "grade"){
              return gradenumtolet(d[f]);
            } else {
            return d[f];
            }
          });
        });
  sumbox.append("div").attr("id", "sumbarchartcontainer");
  makegradebarchart(gradesdata,"#sumbarchartcontainer","#sumbarchart");  
}

function maketeachersummarybox(teacher, teacherl, semester){
  var gradescount = [0,0,0,0,0,0,0,0,0];
  var currgradesarray = [];
  var gradechangearray = [];
  var bigchanges = [];
  var currfail = [];
  var nowpassing = [];
  for (let group of Object.keys(teacherl[teacher][semester])){
    for (let subj of Object.keys(teacherl[teacher][semester][group])){
      for (let student of Object.keys(teacherl[teacher][semester][group][subj])){
        getsummaryboxstats(teacherl,teacher,semester,group,subj,student,
                  gradescount,currgradesarray, gradechangearray, bigchanges,
                  currfail,nowpassing);
    } 
  }
  }
  writesummarybox(gradescount,currgradesarray,
    gradechangearray,bigchanges,currfail,nowpassing);
}

function teachersumtabletoggle(arrow, table){
  if (d3.select(arrow).text() == "▼"){
    d3.select(arrow).html("&#9650;"); 
    d3.select(table).attr("hidden", null);
  } else {
    d3.select(arrow).html("&#9660;");
    d3.select(table).attr("hidden", true);
  }
}

function makesummary(){
  const checkteacher = new Promise(function(resolve, reject){
  if (teacherl != {}){
    generateteacherl();
  }
  resolve("1");
  });
  checkteacher.then(function(){
  contents.html("");
  selecttoptab("#sumtab");
  contents.append("div") 
          .attr("id", "summarytabs");
  d3.select("#summarytabs").append("table")
    .attr("id","summarytabstable")
    .attr("class", "tabs")
    .html("<tr><td onclick='makesummaryprogress()' id='studentprogtab'>Student Progress</td>".concat(
      "<td onclick='makesummaryabberations()' id='gradeoddtab'>Grade Oddities</td>",
      "<td onclick='makesummaryteachers()' id='teachsummarytab'>Teacher Grades</td>"));
  contents.append("div")
          .attr("id", "summarySelector");
  contents.append("div")
          .attr("id", "summaryContent");

  });
}

function getstudentswithgrade(classl, grades, semester){
  //Take in classl and an array of grades (as numbers), and a semester
  //Return all students with those grades
  var studentlist = {};
  for (let group of Object.keys(classl)){
    for (let student of Object.keys(classl[group])){
      if (Object.keys(classl[group][student].grades).includes(semester)){
      for (let subj of Object.keys(classl[group][student].grades[semester])){
        if (grades.includes(classl[group][student].grades[semester][subj])){
          if (!Object.keys(studentlist).includes(classl[group][student].name)){
            studentlist[classl[group][student].name] = [group, [subj,gradenumtolet(classl[group][student].grades[semester][subj])]];
          } else {
            studentlist[classl[group][student].name].push(
              [subj,gradenumtolet(classl[group][student].grades[semester][subj])]
              );
          }
        }
      }
      }
    }
  }
  return studentlist;
}

function getstudentswithgradechange(teacherl, change, direction, semester){
  //This works in an odd way because of the data slices. Could fix data slices
  //but that would be slow to write.
  //direction: -1 - decrease
  //            1 - increase
  //            0 - any change
  // changes: {grade: [change, current grade, previous grade]}
  if (![0,1,-1].includes(direction)){
    throw direction + " is not a valid direction for getstudentswithgradechange";
  }
  var studentlist = {};
  for (let teacher of Object.keys(teacherl)){
    if (Object.keys(teacherl[teacher]).includes(semester)){
      for (let group of Object.keys(teacherl[teacher][semester])){
        for (let subj of Object.keys(teacherl[teacher][semester][group]))
          for (let student of Object.keys(teacherl[teacher][semester][group][subj])){
            if (!isNaN(teacherl[teacher][semester][group][subj][student].prevgrade) &&
              !["7","8",""].includes(teacherl[teacher][semester][group][subj][student].prevgrade) &&
              !["7","8",""].includes(teacherl[teacher][semester][group][subj][student].grade)){
              var gradechange = teacherl[teacher][semester][group][subj][student].grade%6 -
                teacherl[teacher][semester][group][subj][student].prevgrade%6;
                if ((direction != 0 && direction*gradechange >= change) || direction == 0 && Math.abs(gradechange) >= change){
                  if (Object.keys(studentlist).includes(student)){
                    studentlist[student].changes[subj] = [gradechange, 
                    teacherl[teacher][semester][group][subj][student].grade, 
                    teacherl[teacher][semester][group][subj][student].prevgrade];
                  } else {
                    studentlist[student] = {"fname": teacherl[teacher][semester][group][subj][student].fname,
                                            "lname": teacherl[teacher][semester][group][subj][student].lname,
                                            "group": group,
                                            "changes": {}
                                          };
                    studentlist[student].changes[subj] = [gradechange, 
                    teacherl[teacher][semester][group][subj][student].grade, 
                    teacherl[teacher][semester][group][subj][student].prevgrade];
                  }
              }
            }
          }
      }
    }
  }
  return studentlist;
}

function makestudentgradechangerow(student){
  //takes in student from "selectnewstudproggradechange" and outputs table row
  var output = "<td>";
  output += student.fname + " " + student.lname + "</td><td>" + student.group + "</td>";
  subjs = Object.keys(student.changes).sort(sortsubjectorder);
  for (let subj of subjs){
    output += "<td><b>" + subj + "</b> (" + student.changes[subj][0] + ") " + 
    gradenumtolet(student.changes[subj][1]) + "←" + gradenumtolet(student.changes[subj][2]) + "</td>"; 
  }
  return output;
}

function selectnewstudproggradechange(){
  var change = d3.select("#gradechangeamountselector").property("value");
  var direction = document.getElementById("gradechangedirectionselector").selectedIndex - 1;
  var currsemester = d3.select("#studprogsemesterselector").property('value');
  d3.select("#gradechangetable").remove();
  var studentlist = getstudentswithgradechange(teacherl, change, direction, currsemester);
  var gctable = d3.select("#summaryContent").append("table")
                  .attr("id", "gradechangetable");
  //Do bad confusing inline sort to stop things going out of scope
  for (let student of Object.keys(studentlist).sort(function(a,b){  
    if (studentlist[a].group < studentlist[b].group){
      return 1;
    } else if (studentlist[b].group < studentlist[a].group){
      return -1;
    } else if (studentlist[a].fname < studentlist[b].fname){
      return -1;
    } else {
      return 1;
  }})){
    gctable.append("tr").html(makestudentgradechangerow(studentlist[student])); //FIX AGAINST INJECTION
  }
}

function getstudentswithslope(classl, slope, direction){
  if (![1,-1].includes(direction)){
    throw direction + " is not a valid direction is getstudentswithslope";
  }
  var studentlist = {};
  for (let group of Object.keys(classl)){
    for (let student of Object.keys(classl[group])){
      if (direction == 1 && classl[group][student].advanced.linav > slope || 
        direction == -1 && classl[group][student].advanced.linav < slope){
         studentlist[student] = [classl[group][student].name,
                                group,
                                classl[group][student].advanced.linav];
      } 
    }
  }
  return studentlist;
}

function selectnewstudprogslope(){
  d3.select("#studprogslopetable").remove();
  var slope = d3.select(slopenuminput).property("value");
  var direction = document.getElementById("negslopeprogdirselector").selectedIndex;
  if (direction == 0){
    direction = -1;
  }
  studentlist = getstudentswithslope(classl, slope, direction);
  var slopetable = d3.select("#summaryContent").append("table").attr("id","studprogslopetable");
  for (let student of Object.keys(studentlist).sort(function(a,b){ 
    return ((-direction)*(studentlist[a][2] - studentlist[b][2])); 
    //Sort into ascending/descending order depending on direction
  })){
    slopetable.append("tr").selectAll("td").data(studentlist[student]).enter()
                          .append("td").text(function(d){
                            if (!isNaN(d)){ d = d.toFixed(4);} 
                            return d;});
  }
}

var studprogoptions = {
  missinggrades : {
    text: "Missing Grades",
    f: function(){
      //Make dropdown for semesters
      if (!(document.getElementById("studprogsemesterselector"))){
        d3.select("#summarySelector").append("select")
                               .attr("id", "studprogsemesterselector")
                               .selectAll("option")
                               .data(["Semester"].concat(totalsemesters)).enter()
                               .append("option")
                               .text(function(d){
                                  return d;
                               });
        document.getElementById('studprogsemesterselector').selectedIndex = 1;
      }
      //Set function for changing semester
      d3.select("#studprogsemesterselector").on("change", function(){
          var selected = document.getElementById('studprogselector').selectedIndex;
          if (selected != 0){
            studprogoptions[Object.keys(studprogoptions)[selected - 1]].f();
      }
      });
      //Blank target div
      d3.select("#summaryContent").html("");
      //Select a semester if none selected
      if (document.getElementById('studprogsemesterselector').selectedIndex == 0){
        document.getElementById('studprogsemesterselector').selectedIndex = 1;
      }
      var currsemester = d3.select('#studprogsemesterselector').property('value');
      //Get list of students with missing grades
      var studentlist = getstudentswithgrade(classl, [7,8], currsemester);
      //Format list of grades
      var mgtable = d3.select("#summaryContent").append("table")
                      .attr("id", "missinggradestable");
      for (let student of Object.keys(studentlist)){
        mgtable.append("tr")
               .selectAll("td")
               .data([student].concat(studentlist[student])).enter()
               .append("td")
               .text(function(d){
                if (typeof(d) === "string"){
                  return d;
                } else {
                  return d.join(": ");
                }
               });
      }
    }
  },
  failing : {
    text: "Any Failing Grade",
    f: function(){
      //Make dropdown for semesters
      if (!(document.getElementById("studprogsemesterselector"))){
        d3.select("#summarySelector").append("select")
                               .attr("id", "studprogsemesterselector")
                               .selectAll("option")
                               .data(["Semester"].concat(totalsemesters)).enter()
                               .append("option")
                               .text(function(d){
                                  return d;
                               });
        document.getElementById('studprogsemesterselector').selectedIndex = 1;
      }
      //Set function for changing semester
      d3.select("#studprogsemesterselector").on("change", function(){
          var selected = document.getElementById('studprogselector').selectedIndex;
          if (selected != 0){
            studprogoptions[Object.keys(studprogoptions)[selected - 1]].f();
      }
      });
      //Blank target div
      d3.select("#summaryContent").html("");
      if (document.getElementById('studprogsemesterselector').selectedIndex == 0){
        document.getElementById('studprogsemesterselector').selectedIndex = 1;
      }
      var currsemester = d3.select('#studprogsemesterselector').property('value');
      //Get list of students with missing grades
      var studentlist = getstudentswithgrade(classl, [6], currsemester);
      //Format list of grades
      var fstable = d3.select("#summaryContent").append("table")
                      .attr("id", "failingstudentstable");
      for (let student of Object.keys(studentlist)){
        fstable.append("tr")
               .selectAll("td")
               .data([student].concat(studentlist[student])).enter()
               .append("td")
               .text(function(d){
                if (typeof(d) === "string"){
                  return d;
                } else {
                  return d.join(": ");
                }
               });
      }
    }
  },
  gradechange : {
    text: "Significant Grade Changes",
    f: function(){
      //Make dropdown for semesters
      if (!(document.getElementById("studprogsemesterselector"))){
        d3.select("#summarySelector").append("select")
                               .attr("id", "studprogsemesterselector")
                               .selectAll("option")
                               .data(["Semester"].concat(totalsemesters)).enter()
                               .append("option")
                               .text(function(d){
                                  return d;
                               });
        document.getElementById('studprogsemesterselector').selectedIndex = 1;
      }
      //Set function for changing semester
      d3.select("#studprogsemesterselector").on("change", function(){
        if (document.getElementById('studprogsemesterselector').selectedIndex == 0){
          document.getElementById('studprogsemesterselector').selectedIndex = 1;
        }
        selectnewstudproggradechange();
      });
      //Blank target div
      d3.select("#summaryContent").html("");
      //Select a semester if none selected

      var currsemester = d3.select('#studprogsemesterselector').property('value');
      var gcchoices = d3.select("#summaryContent").append("div")
                                  .attr("id", "gradechangechoices");

      //Build little choices text
      gcchoices.append("span").text("Show students with grades which ");
      var gcdselector = gcchoices.append("select").attr("id", "gradechangedirectionselector");
          gcdselector.append("option").text("decreased");
          gcdselector.append("option").text("changed");
          gcdselector.append("option").text("increased");
      gcchoices.append("span").text(" by at least ");
      var gcnselector = gcchoices.append("select").attr("id", "gradechangeamountselector")
                                 .selectAll("option") 
                                 .data([1,2,3,4,5]).enter()
                                 .append("option").text(function(d){ return d;});
      gcchoices.append("span").text(" letters.");
      document.getElementById("gradechangeamountselector").selectedIndex = 1;
      d3.select("#gradechangedirectionselector").on("change",selectnewstudproggradechange);
      d3.select("#gradechangeamountselector").on("change",selectnewstudproggradechange);
      selectnewstudproggradechange();
    }
  },
  negtiveslope: {
    text: "Changing Grade Average",
    f: function(){
      d3.select("#studprogsemesterselector").remove();
      d3.select("#summaryContent").html("");
      //Make little selector text
      var nschoices = d3.select("#summaryContent").append("div").attr("id", "negslopeprogchoices");
      nschoices.append("span").text("Show students with grade gradient ");
      nschoices.append("select").attr("id", "negslopeprogdirselector");
      d3.select("#negslopeprogdirselector").append("option").text("less than");
      d3.select("#negslopeprogdirselector").append("option").text("greater than");
      nschoices.append("input").attr("id", "slopenuminput").attr("type", "number")
                               .attr("size", "5"); //Make less wide
      document.getElementById("slopenuminput").value = "0.0"; //Default value is 0
      selectnewstudprogslope();
      d3.select("#negslopeprogdirselector").on("change",selectnewstudprogslope);
      d3.select("#slopenuminput").on("change",selectnewstudprogslope);
    }
  },
  qualify : {
    text: "Doesn't Qualify for Course",
    f: function(){
      d3.select("#studprogsemesterselector").remove();
      d3.select("#summaryContent").html("Coming Soon");
    }
  }
};

function selectnewstudprog(){
  var selected = document.getElementById('studprogselector').selectedIndex;
  if (selected != 0){

    studprogoptions[Object.keys(studprogoptions)[selected - 1]].f();
  }
}


function makesummaryprogress(){
  clearpage();
  document.getElementById('studentprogtab').className = 'tabselected';
  document.getElementById('gradeoddtab').classList.remove('tabselected');
  document.getElementById('teachsummarytab').classList.remove('tabselected');

  //Make dropdown out of elements of "studprogoptions", and call corresponding
  //function when selected
  d3.select("#summarySelector").append("select")
                              .attr("id","studprogselector")
                              .selectAll("option")
                              .data(["Show students with:"].concat(Object.keys(studprogoptions))).enter()
                              .append("option")
                              .text(function(d){if (d != "Show students with:"){
                                return studprogoptions[d].text;}
                                 else{return d;}});
  d3.select("#studprogselector").on("change", selectnewstudprog);
}

function isMultimodal(data, sensitivity = 0.75){
  //Runs simple check if an array of numbers is bimodal: 
  //If there is a data point in between two 'peak' data points with size less 
  //than sensitivity * min(peaks), returns true, else false

  // Check if data is acceptable:
  if (!Array.isArray(data) || data.some(isNaN) || data.some(num => num < 0)){
    throw "Input to 'isBimodal' must be an array of positve values. Passed " + data;
  } else if (data.length < 3) {
    return false; //two data points aren't bimodal in the sense we care about
  }
  if (isNaN(sensitivity) || sensitivity <= 0 || sensitivity >=1){
    throw "Invalid sensitivity for 'isBimodal' Must be a positive number less than 1. Passed " + sensitivity;
  }

  var peaks = [];
  var peakIndices = [];
  var peakcheck = true;
  var valleymin = data[0];

  //Run through data. Mark each peak.
  //If there's a point between that peak and the next less than 
  //sensitivity * (min(peaks)): data is multimodal
  for (i = 1; i < data.length; i++){
    if (data[i-1] < data[i]){
      peakcheck = true;
    } else if (data[i-1] > data[i]){
      if (peakcheck === true){
        peaks.push(data[i-1]);
        peakIndices.push(i-1);
        if (peaks.length >= 2 && valleymin < 
                sensitivity*Math.min(...peaks.slice(peaks.length-2))){
          return true;
        }
      }
      if (data[i] < valleymin){
        valleymin = data[i];
      }
      peakcheck = false;
    }
  }

  //Check final point
  if (data[data.length - 2] < data[data.length - 1]){
    peaks.push(data[data.length-1]);
    peakIndices.push(data.length-1);
    if (peaks.length >= 2 && valleymin < 
          sensitivity*Math.min(...peaks.slice(peaks.length-2))){
      return true;
    }
  }

  //If data isn't multimodal
  return false;
}

function isStudentMultimodal(student, semester, sensitivity){
  //Checks if the student's grades for the semester were multimodal
  if (!Object.keys(student.grades).includes(semester)){
    return false; //student has no grades in semester. Therefore not multimodal
  }
  var gradecounts = [0,0,0,0,0,0,0,0,0];
  for (let subj of Object.keys(student.grades[semester])){
    if(!notsubjects.includes(subj)){
      gradecounts[student.grades[semester][subj]] += 1;
    }
  }
  var gradeorder = [5,4,3,2,1,6,7,8];
  gradecounts = gradeorder.map(x => gradecounts[x]);
  return(isMultimodal(gradecounts,sensitivity));
}

function getStudentVariance(student, semester, mode = 0){
  // Mode = 0: base variance on grade letter
  // Mode = 1: base variance on merit points
  // This could do with some refactoring
  if (![0,1].includes(mode)){
    throw "Invalid mode for getStudentVariance. Requires 0 or 1, passed: " + mode;
  }
  if (!Object.keys(student.grades).includes(semester)){
    return false;
  } else {
    var mean = 0;
    var count = 0;
    var variance = 0.0;
    if (mode == 0){
      for (let subj of Object.keys(student.grades[semester])){
        if (!notsubjects.includes(subj) && student.grades[semester][subj] < 7){
          mean += student.grades[semester][subj]%6 + 1;
          count += 1;
        }
      }
      if (count < 2){
        return 0;
      }
      mean /= count;
      for (let subj of Object.keys(student.grades[semester])){
        if (!notsubjects.includes(subj) && student.grades[semester][subj] < 7){
          variance += (student.grades[semester][subj]%6 + 1 - mean) ** 2;
        }
      }
    } else {
        for (let subj of Object.keys(student.grades[semester])){
        if (!notsubjects.includes(subj) && student.grades[semester][subj] < 7){
          mean += gradetomerits(student.grades[semester][subj]);
          count += 1;
        }
      }
      if (count < 2){
        return 0;
      }
      mean /= count;
      for (let subj of Object.keys(student.grades[semester])){
        if (!notsubjects.includes(subj) && student.grades[semester][subj] < 7){
          variance += (gradetomerits(student.grades[semester][subj]) - mean) ** 2;
        }
      }
    }
    return [mean, variance/count];
  }
}

function selectnewhgvvalue(){
  d3.select("#hgvabbertable").remove();
  var currsemester = d3.select('#abbersemesterselector').property('value');
  var variancelimit = d3.select('#hgvnuminput').property('value');
  var mode = 0;
  if (d3.select("#hgvabbermodeselect").property("checked") == true){
    mode = 1;
  }
  var studentlist = [];
  var currvariance = 0;
  for (let group of Object.keys(classl)){
    for (let student of Object.keys(classl[group])){
      currvariance = getStudentVariance(classl[group][student], currsemester, mode);
        if (currvariance[1] > variancelimit ){
          studentlist.push([classl[group][student].name, group, "<b>Mean:</b> ", currvariance[0].toFixed(2), "<b>Variance: </b>", currvariance[1].toFixed(2)]);
        }
    }
  }
  d3.select("#summaryContent").append("table").attr("id", "hgvabbertable");
  for (let item of studentlist){
    d3.select("#hgvabbertable").append("tr")
                              .selectAll("td")
                              .data(item).enter()
                              .append("td")
                              .html(function(d){ return d;}); //FIX AGAINST INJECTION
  }
}

var abberationsoptions = {
  fanda : {
    text : "Both F and A Grades",
    f: function(){
      //Make dropdown for semesters
      if (!(document.getElementById("abbersemesterselector"))){
        d3.select("#summarySelector").append("select")
                               .attr("id", "abbersemesterselector")
                               .selectAll("option")
                               .data(["Semester"].concat(totalsemesters)).enter()
                               .append("option")
                               .text(function(d){
                                  return d;
                               });
        document.getElementById('abbersemesterselector').selectedIndex = 1;
      }
      //Set function for changing semester
      d3.select("#abbersemesterselector").on("change", function(){
          var selected = document.getElementById('studabberselector').selectedIndex;
          if (selected != 0){
            abberationsoptions[Object.keys(abberationsoptions)[selected - 1]].f();
      }
      });
      //Blank target div
      d3.select("#summaryContent").html("");
      //Select a semester if none selected
      if (document.getElementById('abbersemesterselector').selectedIndex == 0){
        document.getElementById('abbersemesterselector').selectedIndex = 1;
      }
      var currsemester = d3.select('#abbersemesterselector').property('value');
      var alist = getstudentswithgrade(classl,[5],currsemester);
      var flist = getstudentswithgrade(classl,[6],currsemester);
      var aandflist = getstudentswithgrade(classl, [5,6], currsemester);
      var aandf = Object.keys(alist).filter(function(n){
          return Object.keys(flist).indexOf(n) > -1;
        }); //Names on both lists
      var fandatable = d3.select("#summaryContent").append("table")
                         .attr("id", "fandaabbertable");
      for (let student of aandf){
        fandatable.append("tr")
               .selectAll("td")
               .data([student].concat(aandflist[student])).enter()
               .append("td")
               .text(function(d){
                if (typeof(d) === "string"){
                  return d;
                } else {
                  return d.join(": ");
                }
               });
      }

    }
  },
  multimodal : {
    text: "Multimodal Grades",
    f: function(){
      //Make dropdown for semesters
      if (!(document.getElementById("abbersemesterselector"))){
        d3.select("#summarySelector").append("select")
                               .attr("id", "abbersemesterselector")
                               .selectAll("option")
                               .data(["Semester"].concat(totalsemesters)).enter()
                               .append("option")
                               .text(function(d){
                                  return d;
                               });
        document.getElementById('abbersemesterselector').selectedIndex = 1;
      }
      //Set function for changing semester
      d3.select("#abbersemesterselector").on("change", function(){
          var selected = document.getElementById('studabberselector').selectedIndex;
          if (selected != 0){
            abberationsoptions[Object.keys(abberationsoptions)[selected - 1]].f();
      }
      });
      //Blank target div
      d3.select("#summaryContent").html("");
      if (document.getElementById('abbersemesterselector').selectedIndex == 0){
        document.getElementById('abbersemesterselector').selectedIndex = 1;
      }
      var currsemester = d3.select('#abbersemesterselector').property('value');
      var warningtext = "This test will miss students with particularly odd grade distibutions, (specifically: trimodal distributions in which the central high point is lower than the two outer). This is rare, but should be accounted for. (This may be fixed in a future version). ";
      d3.select("#summaryContent").append("span").text(warningtext);

      var mmtable = d3.select("#summaryContent").append("table")
                                               .attr("id", "mmodabbertable");
      for (let year of Object.keys(classl)){
        for (let student of Object.keys(classl[year])){
          if (isStudentMultimodal(classl[year][student], currsemester, 0.75)) //hardcoded sensitivity
            d3.select("#mmodabbertable").append("tr").html("<td>" + year + "</td><td>" + classl[year][student].name);
      } //FIX AGAINST INJECTION
      }
    }
  },
  highvariance: {
    text: "High Grade Variance",
    f: function(){
      var gradebounddefault = "2.5";
      var meritbounddefault = "35";
      if (!(document.getElementById("abbersemesterselector"))){
        d3.select("#summarySelector").append("select")
                               .attr("id", "abbersemesterselector")
                               .selectAll("option")
                               .data(["Semester"].concat(totalsemesters)).enter()
                               .append("option")
                               .text(function(d){
                                  return d;
                               });
        document.getElementById('abbersemesterselector').selectedIndex = 1;
      }
      //Set function for changing semester
      d3.select("#abbersemesterselector").on("change", function(){
          var selected = document.getElementById('studabberselector').selectedIndex;
          if (selected != 0){
            abberationsoptions[Object.keys(abberationsoptions)[selected - 1]].f();
      }
      });
      //Blank target div
      d3.select("#summaryContent").html("");
      if (document.getElementById('abbersemesterselector').selectedIndex == 0){
        document.getElementById('abbersemesterselector').selectedIndex = 1;
      }

      //Make little selector text
      var hgvchoices = d3.select("#summaryContent").append("div").attr("id", "hgvabberchoices");
      hgvchoices.append("span").text("Show students with grade variance greater than ");
      hgvchoices.append("input").attr("id", "hgvnuminput").attr("type", "number")
                               .attr("size", "5"); //Make less wide
      hgvchoices.append("br");
      hgvchoices.append("input").attr("type", "checkbox").attr("id", "hgvabbermodeselect");
      hgvchoices.append("span").text("Use merits to calculate variance (default is F=1, A=6)");
      document.getElementById("hgvnuminput").value = gradebounddefault; 
      selectnewhgvvalue();
      d3.select("#hgvnuminput").on("change",selectnewhgvvalue);
      d3.select("#hgvabbermodeselect").on("change", function(){
        if (d3.select("#hgvabbermodeselect").property("checked") == true){
          document.getElementById("hgvnuminput").value = meritbounddefault;} 
        else {
          document.getElementById("hgvnuminput").value = gradebounddefault;
          }
        selectnewhgvvalue();});
      }
    }
};

function makesummaryabberations(){
  clearpage();
    document.getElementById('studentprogtab').classList.remove('tabselected');
    document.getElementById('gradeoddtab').className = 'tabselected';
    document.getElementById('teachsummarytab').classList.remove('tabselected');
  //Make dropdown out of elements of "abberationsoptions", and call corresponding
  //function when selected
  d3.select("#summarySelector").append("select")
                              .attr("id","studabberselector")
                              .selectAll("option")
                              .data(["Show students with:"].concat(Object.keys(abberationsoptions))).enter()
                              .append("option")
                              .text(function(d){if (d != "Show students with:") {
                                return abberationsoptions[d].text;}
                                else {return d;}});
  d3.select("#studabberselector").on("change", function(){
    var selected = document.getElementById('studabberselector').selectedIndex;
    if (selected != 0){
      abberationsoptions[Object.keys(abberationsoptions)[selected-1]].f();
    }
  });
}

function getTeacherVariance(teacher, semester, mode=0){
  // Mode = 0: base variance on grade letter
  // Mode = 1: base variance on merit points
  if (![0,1].includes(mode)){
    throw "Invalid mode for getTeacherVariance. Requires 0 or 1, passed: " + mode;
  }
  if (!Object.keys(teacher).includes(semester)){
    return [false,0];
  } else {
    var mean = 0;
    var count = 0;
    var variance = 0.0;
    if (mode == 0){
      for (let group of Object.keys(teacher[semester])){
        for (let subj of Object.keys(teacher[semester][group])){
          for (let student of Object.keys(teacher[semester][group][subj])){
            if (!notsubjects.includes(subj) && teacher[semester][group][subj][student].grade < 7){
              mean += parseInt(teacher[semester][group][subj][student].grade);
              count += 1;
            }
          }
        }
      }
      if (count < 2){
        return [mean/count,0];
      }
      mean /= count;
      for (let group of Object.keys(teacher[semester])){
        for (let subj of Object.keys(teacher[semester][group])){
          for (let student of Object.keys(teacher[semester][group][subj])){
            if (!notsubjects.includes(subj) && teacher[semester][group][subj][student].grade < 7){
              variance += (parseInt(teacher[semester][group][subj][student].grade) - mean) ** 2;
            }
          }
        }
      }
    } else {
      for (let group of Object.keys(teacher[semester])){
        for (let subj of Object.keys(teacher[semester][group])){
          for (let student of Object.keys(teacher[semester][group][subj])){
            if (!notsubjects.includes(subj) && teacher[semester][group][subj][student].grade < 7){
              mean += gradetomerits(teacher[semester][group][subj][student].grade);
              count += 1;
            }
          }
        }
      }
      if (count < 2){
        return [mean/count,0];
      }
      mean /= count;
      for (let group of Object.keys(teacher[semester])){
        for (let subj of Object.keys(teacher[semester][group])){
          for (let student of Object.keys(teacher[semester][group][subj])){
            if (!notsubjects.includes(subj) && teacher[semester][group][subj][student].grade < 7){
              variance += (gradetomerits(teacher[semester][group][subj][student].grade) - mean) ** 2;
            }
          }
        }
      }
    }
    return [mean, variance/count];
  }
}

function selectnewtgvvalue(){
  d3.select("#tgvtable").remove();
  var currsemester = d3.select('#teachgsemesterselector').property('value');
  var variancelimit = d3.select('#tgvnuminput').property('value');
  var mode = 0;
  if (d3.select("#tgvmodeselect").property("checked") == true){
    mode = 1;
  }
  var teacherlist = [];
  var currvariance = 0;
  for (let teacher of Object.keys(teacherl)){
    currvariance = getTeacherVariance(teacherl[teacher], currsemester, mode);
        if (currvariance[1] < variancelimit && currvariance[0]){
          teacherlist.push([teacher, "<b>Mean:</b> ", currvariance[0].toFixed(2), "<b>Variance: </b>", currvariance[1].toFixed(2)]);
        }
    }
  d3.select("#summaryContent").append("table").attr("id", "tgvtable");
  for (let item of teacherlist){
    d3.select("#tgvtable").append("tr")
                              .selectAll("td")
                              .data(item).enter()
                              .append("td")
                              .html(function(d){ return d;}); //FIX AGAINST INJECTION
  }
}

function getteachermeangradechange(teacher, semester){
  // Returns [mean change, number of changes]
  var count = 0;
  var sum = 0;
  if (!Object.keys(teacher).includes(semester)){
    return [false, 0];
  } else {
    for (let group of Object.keys(teacher[semester])){
      for (let subj of Object.keys(teacher[semester][group])){
        for (let student of Object.keys(teacher[semester][group][subj])){
          if (!isNaN(parseInt(teacher[semester][group][subj][student].prevgrade))){
            sum += Math.abs(parseInt(teacher[semester][group][subj][student].prevgrade) - 
                parseInt(teacher[semester][group][subj][student].grade));
            count += 1;
          }
        }
      }
    }
    return [sum/count, count];
  }
}

function getteacherskew(teacher, semester){
  //Calculates Pearson's second coefficient of skewedness for given grades
  var [mean, variance] = getTeacherVariance(teacher, semester, 0);
  if (mean == false || variance == 0){
    //returns false if teacher didn't grade in semester
    return NaN;
  }
  var mode = 0;
  var counts = [0,0,0,0,0,0];
  var total = 0;
  for (let group of Object.keys(teacher[semester])){
    for (let subj of Object.keys(teacher[semester][group])){
      for (let student of Object.keys(teacher[semester][group][subj])){
        counts[parseInt(teacher[semester][group][subj][student].grade)%6] += 1;
        total += 1;
      }
    }
  }
  //get (index of median value) + 1
  total /= 2;
  var index = 0;
  while (total > 0){
    total -= counts[index];
    index += 1;
  }
  //Assume median grade should be C.
  return -((4 - index)/Math.sqrt(variance));
}

function selectnewskew(){
  d3.select("#skewtable").remove();
  var skewoption = document.getElementById("skewselector").selectedIndex;
  var currentsemester = d3.select("#teachgsemesterselector").property("value");
  var hmgctable = d3.select("#summaryContent").append("table").attr("id", "hmgctable");
  teacherlist = [];
  for (let teacher of Object.keys(teacherl)){
    var skew = getteacherskew(teacherl[teacher], currentsemester);
    if (!isNaN(skew)){
      if (skewoption == 2 || skewoption == 1 && skew > 0 || skewoption == 0 && skew < 0) {
        teacherlist.push([teacher, skew]);
      }
    }
  }
  if (skewoption != 1){
    teacherlist.sort(function(a,b){return a[1]-b[1];});
  } else {
    teacherlist.sort(function(a,b){return b[1]-a[1];});
  }
  var skewtable = d3.select("#summaryContent").append("table").attr("id", "skewtable");
  var skewhead = skewtable.append("tr");
  skewhead.append("th").text("Name");
  skewhead.append("th").text("Skew");
  for (let entry of teacherlist){
    entry[1] = entry[1].toFixed(3);
    skewtable.append("tr").selectAll("td").data(entry).enter()
                          .append("td").text(function(d){return d;});
  }
}

var teachgradeoptions = {
  lowvariance: {
    text: "Low Grading Variance",
    f: function(){
      var gradebounddefault = "1";
      var meritbounddefault = "10";
      if (!(document.getElementById("teachgsemesterselector"))){
        d3.select("#summarySelector").append("select")
                               .attr("id", "teachgsemesterselector")
                               .selectAll("option")
                               .data(["Semester"].concat(totalsemesters)).enter()
                               .append("option")
                               .text(function(d){
                                  return d;
                               });
        document.getElementById('teachgsemesterselector').selectedIndex = 1;
      }
      //Set function for changing semester
      d3.select("#teachgsemesterselector").on("change", function(){
          var selected = document.getElementById('teachgradeselector').selectedIndex;
          if (selected != 0){
            teachgradeoptions[Object.keys(teachgradeoptions)[selected - 1]].f();
      }
      });
      //Blank target div
      d3.select("#summaryContent").html("");
      if (document.getElementById('teachgsemesterselector').selectedIndex == 0){
        document.getElementById('teachgsemesterselector').selectedIndex = 1;
      }
      
      //Make little selector text
      var tgvchoices = d3.select("#summaryContent").append("div").attr("id", "tgvchoices");
      tgvchoices.append("span").text("Show teachers with grade variance less than ");
      tgvchoices.append("input").attr("id", "tgvnuminput").attr("type", "number")
                               .attr("size", "5"); //Make less wide
      tgvchoices.append("br");
      tgvchoices.append("input").attr("type", "checkbox").attr("id", "tgvmodeselect");
      tgvchoices.append("span").text("Use merits to calculate variance (default is F=1, A=6)");
      document.getElementById("tgvnuminput").value = gradebounddefault; 
      selectnewtgvvalue();
      d3.select("#tgvnuminput").on("change",selectnewtgvvalue);
      d3.select("#tgvmodeselect").on("change", function(){
        if (d3.select("#tgvmodeselect").property("checked") == true){
          document.getElementById("tgvnuminput").value = meritbounddefault;} 
        else {
          document.getElementById("tgvnuminput").value = gradebounddefault;
          }
        selectnewtgvvalue();});
      }
    },
  skewedcurve: {
    text: "Skewed Grading Curve",
    f: function(){
      if (!(document.getElementById("teachgsemesterselector"))){
        d3.select("#summarySelector").append("select")
                               .attr("id", "teachgsemesterselector")
                               .selectAll("option")
                               .data(["Semester"].concat(totalsemesters)).enter()
                               .append("option")
                               .text(function(d){
                                  return d;
                               });
        document.getElementById('teachgsemesterselector').selectedIndex = 1;
      }
      //Set function for changing semester
      d3.select("#teachgsemesterselector").on("change", function(){
          var selected = document.getElementById('teachgradeselector').selectedIndex;
          if (selected != 0){
            teachgradeoptions[Object.keys(teachgradeoptions)[selected - 1]].f();
      }
      });
      //Blank target div
      d3.select("#summaryContent").html("");
      if (document.getElementById('teachgsemesterselector').selectedIndex == 0){
        document.getElementById('teachgsemesterselector').selectedIndex = 1;
      }
      //Make selector
      var skewchoice = d3.select("#summaryContent").append("div").attr("id", "skchoice");
      skewchoice.append("span").text("Show teachers with ");
      var skewselector = skewchoice.append("select").attr("id", "skewselector");
      skewselector.append("option").text("negative");
      skewselector.append("option").text("positive");
      skewselector.append("option").text("any");
      skewchoice.append("span").text(" skew. (Uses Pearson's 2nd Coefficient with mean C)");
      skewchoice.on("change", selectnewskew);
      selectnewskew();
    }
  },
  highmeanchange: {
    text: "High Mean Grade Change",
    f: function(){
      if (!(document.getElementById("teachgsemesterselector"))){
        d3.select("#summarySelector").append("select")
                               .attr("id", "teachgsemesterselector")
                               .selectAll("option")
                               .data(["Semester"].concat(totalsemesters)).enter()
                               .append("option")
                               .text(function(d){
                                  return d;
                               });
        document.getElementById('teachgsemesterselector').selectedIndex = 1;
      }
      //Set function for changing semester
      d3.select("#teachgsemesterselector").on("change", function(){
          var selected = document.getElementById('teachgradeselector').selectedIndex;
          if (selected != 0){
            teachgradeoptions[Object.keys(teachgradeoptions)[selected - 1]].f();
      }
      });
      //Blank target div
      d3.select("#summaryContent").html("");
      if (document.getElementById('teachgsemesterselector').selectedIndex == 0){
        document.getElementById('teachgsemesterselector').selectedIndex = 1;
      }
      var currentsemester = d3.select("#teachgsemesterselector").property("value");
      var hmgctable = d3.select("#summaryContent").append("table").attr("id", "hmgctable");
      teacherlist = [];
      for (let teacher of Object.keys(teacherl)){
        var mgc = getteachermeangradechange(teacherl[teacher], currentsemester);
        if (mgc[1] > 0){
          mgc.unshift(teacher); 
          teacherlist.push(mgc);
        }
      }
      teacherlist.sort(function(a,b){return b[1]-a[1];}); //Sort by average change descending
      hmgctable.append("tr").selectAll("th")
                .data(["Teacher", "Mean Change", "Eligable Grades"]).enter()
                .append("th").html(function(d){ return "<b>" + d + "</d>";});
      for (let entry of teacherlist){
        entry[1] = entry[1].toFixed(2);
        hmgctable.append("tr")
                 .selectAll("td")
                 .data(entry).enter()
                 .append("td").text(function(d){ 
                  return d; });
      }

    }
  }
};

function makesummaryteachers(){
  clearpage();
    document.getElementById('studentprogtab').classList.remove('tabselected');
    document.getElementById('gradeoddtab').classList.remove('tabselected');
    document.getElementById('teachsummarytab').className = 'tabselected';
//Make dropdown out of elements of "teachgradeoptions", and call corresponding
  //function when selected
  d3.select("#summarySelector").append("select")
                              .attr("id","teachgradeselector")
                              .selectAll("option")
                              .data(["Show teachers with:"].concat(Object.keys(teachgradeoptions))).enter()
                              .append("option")
                              .text(function(d){if (d != "Show teachers with:") {
                                return teachgradeoptions[d].text;}
                                else {return d;}});
  d3.select("#teachgradeselector").on("change", function(){
    var selected = document.getElementById('teachgradeselector').selectedIndex;
    if (selected != 0){
      teachgradeoptions[Object.keys(teachgradeoptions)[selected-1]].f();
    }
  });
}

function getsubjectsemesters(subject, teacherl){
  //Gets semesters when grades were given for subject
  var subjectsemesters = [];
  for (let teacher of Object.keys(teacherl)){
    for (let semester of Object.keys(teacherl[teacher])){
      if (!subjectsemesters.includes(semester)){
        for (let sclass of Object.keys(teacherl[teacher][semester])){
          if (Object.keys(teacherl[teacher][semester][sclass])
            .includes(subject) &&
            !subjectsemesters.includes(semester)){
              subjectsemesters.push(semester);
          }
        }
      }
    }
  }
  return subjectsemesters;
}

function getsubjectyears(subject, semester, teacherl){
  //Gets year groups who were given grades for a subject during a semester
  var subjectyears = [];
  for (let teacher of Object.keys(teacherl)){
    if (Object.keys(teacherl[teacher]).includes(semester)){
      for (let sclass of Object.keys(teacherl[teacher][semester])){
        if (!subjectyears.includes(sclass.slice(0,1)) &&
          Object.keys(teacherl[teacher][semester][sclass]).includes(subject)){
            subjectyears.push(sclass.slice(0,1));
        }
      }
    }
  }
  return subjectyears;
}

function makesubject(){
  contents.html("");
  selecttoptab("#subjtab");
  const checkteacher = new Promise(function(resolve, reject){
  if (teacherl != {}){
    generateteacherl();
  }
  resolve("1");
  });
  checkteacher.then(function(){
  //Make page
  var selectenv = d3.select("#sscontent")
    .append("div")
    .attr("id", "selectors");
  var subjectSelect = d3.select("#selectors")
      .append("select")
      .attr("id", "subjectSelector")
      .selectAll("option")
      .data(["Select Subject"].concat(subjects)).enter()
      .append("option")
      .text(function(d) {return d;});
  d3.select("#subjectSelector").on("change", selectnewsubject);
  var subjectSemesterSelect = d3.select("#selectors")
      .append("select")
      .attr("id", "subjectSemesterSelector")
      .selectAll("option")
      .data(["Select Semester"]).enter()
      .append("option")
      .text(function(d) {return d;});
  d3.select("#subjectSemesterSelector").on("change", selectnewsubjectsemester);
  var subjectYearSelect = d3.select("#selectors")
      .append("select")
      .attr("id", "subjectYearSelector")
      .selectAll("option")
      .data(["Overall Summary"]).enter()
      .append("option")
      .text(function(d) {return d;});
  d3.select("#subjectYearSelector").on("change", selectnewsubjectyear);

  d3.select("#sscontent")
      .append("div")
      .attr("id", "teachersummary");

  d3.select("#sscontent")
      .append("div")
      .attr("id","bigtable");
  });
}

function selectnewsubject(){
  if (document.getElementById("subjectSelector").selectedIndex == 0) {

  } else {
    clearpage();
    var currentsubj = d3.select("#subjectSelector").property("value");
    var subjsemesters = getsubjectsemesters(currentsubj, teacherl).sort();
    d3.select("#subjectSemesterSelector")
      .selectAll("option")
      .remove();
    d3.select("#subjectSemesterSelector")
      .selectAll("option")
      .data(["Select Semester"].concat(subjsemesters.reverse())).enter()
      .append("option")
      .text(function(d) {return d;});
    document.getElementById("subjectSemesterSelector").selectedIndex = 1;
    selectnewsubjectsemester();
  }
}

function selectnewsubjectsemester(){
  if (document.getElementById("subjectSemesterSelector").selectedIndex == 0) {
    clearpage();
  } else {
    var currentsemester = d3.select("#subjectSemesterSelector").property("value");
    var currentsubj = d3.select("#subjectSelector").property("value");
    var subjyears = getsubjectyears(currentsubj, currentsemester, teacherl);
    d3.select("#subjectYearSelector")
      .selectAll("option")
      .remove();
    d3.select("#subjectYearSelector")
      .selectAll("option")
      .data(["Overall Summary"].concat(subjyears.sort().reverse())).enter()
      .append("option")
      .text(function(d) {return d;});
    selectnewsubjectyear();
  }
}

function teachertaughtsubjectinsemester(teacher, group, 
  semester, subject, teacherl){
  if (Object.keys(teacherl).includes(teacher)){
    if (Object.keys(teacherl[teacher]).includes(semester)){
      if (Object.keys(teacherl[teacher][semester]).includes(group)){
        if (Object.keys(teacherl[teacher][semester][group]).includes(subject)){
          return true;
        }
      }
    } 
  }
  return false;
}

function selectnewsubjectyear(){
  var classesinyear = [];
  var currentyear = 0;
  //This is filled in by the function below, in a fit of bad coding
  //in order to avoid looping through the dataset again
    clearpage();
    var currentsemester = d3.select("#subjectSemesterSelector").property("value");
    var currentsubj = d3.select("#subjectSelector").property("value");
  d3.select("#bigtable")
    .append("div")
    .attr("id", "teacherclassholder");
  if (document.getElementById("subjectYearSelector").selectedIndex == 0) {
    currentyear = "s";
    makesubjectsummarybox(currentsubj, currentsemester, currentyear, teacherl, 
      classesinyear);
  } else {
    currentyear = d3.select("#subjectYearSelector").property("value");
    makesubjectsummarybox(currentsubj, currentsemester, currentyear, teacherl, 
      classesinyear);
    for (let group of classesinyear){
      d3.select("#teacherclassholder").append("hr");
      d3.select("#teacherclassholder").append("h3").attr("class", "tclasstitle").text(group);
      for (let teacher of Object.keys(teacherl)){
        if (teachertaughtsubjectinsemester(teacher,group,currentsemester,currentsubj, teacherl)){
          d3.select("#teacherclassholder").append("h4").text(teacher);
          maketeacherclasstable(teacher,classl,currentsemester,group,currentsubj);
        }
      }
    }
  }
}

function makesubjectsummarybox(subj, semester, year, teacherl, classesinyear){
  var gradescount = [0,0,0,0,0,0,0,0,0];
  var currgradesarray = [];
  var gradechangearray = [];
  var bigchanges = [];
  var currfail = [];
  var nowpassing = [];
  //don't double-count students who have more than one teacher
  //Assume that both teachers gave the same grade (Schoolsoft requires this)
  var students = [];
  console.log(classesinyear);
  for (let teacher of Object.keys(teacherl)){
    if (Object.keys(teacherl[teacher]).includes(semester)){
      for (let group of Object.keys(teacherl[teacher][semester])){
      if (year === "s" || group.slice(0,1) == year){
        if (!classesinyear.includes(group)){
          classesinyear.push(group);
        }
        if (Object.keys(teacherl[teacher][semester][group]).includes(subj)){
          for (let student of Object.keys(teacherl[teacher][semester][group][subj])){
            if (!students.includes(student)){
              getsummaryboxstats(teacherl,teacher,semester,group,subj,student,
                  gradescount,currgradesarray, gradechangearray, bigchanges,
                  currfail,nowpassing);
              students.push(student);
            }
          }
        }
      }
      }
    }
  }
  writesummarybox(gradescount,currgradesarray,
    gradechangearray,bigchanges,currfail,nowpassing);
}

function getyearaverages(classl,yearl){
  count = 0;
  //Build data structure
  for (let item of Object.keys(classl)){
    var semesters = [];
    var year = item.slice(0,1);
    var ssemesters = Object.keys(yearl[year].summary);
    for (let student of Object.keys(classl[item])){
      for (let semester of Object.keys(classl[item][student].grades)){
        if (!yearl[year][item].hasOwnProperty(semester)){
          yearl[year][item][semester] = {"total": {},
                                           "average": {},
                                           "change": {}};
        }
        if (!yearl[year].summary.hasOwnProperty(semester)){
          yearl[year].summary[semester] = {};
        }
        for (let subj of Object.keys(classl[item][student].grades[semester])){
          //If subject not in totals list yet and valid grade
          if (!yearl[year][item][semester].total.hasOwnProperty(subj)
            && !(gradetomerits(classl[item][student]
              .grades[semester][subj]) == -1)){
                        yearl[year][item][semester].total[subj] =
                        gradetomerits(classl[item][student]
                          .grades[semester][subj]);
                        yearl[year][item][semester].average[subj] = 1;
          } else {
            if (!(gradetomerits(classl[item][student]
              .grades[semester][subj]) == -1)){
            count += 1;
            yearl[year][item][semester].total[subj] +=
                        gradetomerits(classl[item][student]
                          .grades[semester][subj]);
                        yearl[year][item][semester].average[subj] += 1;
            }
          }
        }
      }
    }
  }
  // Make averages
  for (let year of Object.keys(yearl)){
        for (let item of Object.keys(yearl[year])){
          if (item != "summary") {
          for (let semester of Object.keys(yearl[year][item])) {
            if (semester != "summary") {
              for (let subj of Object.keys(yearl[year][item][semester].total)){
                if (notsubjects.includes(subj)) {
                  delete yearl[year][item][semester].total[subj];
                  delete yearl[year][item][semester].average[subj];
                }
                else {
                  yearl[year][item][semester].average[subj] =
                  yearl[year][item][semester].total[subj]/
                  yearl[year][item][semester].average[subj];
                }
              }
            }
          }
          //calculate average change from last semester
          for (let semester of Object.keys(yearl[year][item])) {
          if (semester != "summary") {
              var prevsemester = semesterbefore(yearl[year][item], semester);
              if (prevsemester != false) {
                for (let subj of Object.keys(yearl[year][item][semester]
                  .average)){
                  if (yearl[year][item][prevsemester]
                    .average.hasOwnProperty(subj))
                  {
                    yearl[year][item][semester].change[subj] =
                      yearl[year][item][semester].average[subj] -
                      yearl[year][item][prevsemester].average[subj];
                  }
                }
              }
            }
          }
        }
        }
  }
  //Make overall summaries for each semester

  //Loop through each year and semester for the year, add data to summary
  for (let year of Object.keys(yearl)){
    for (let term of Object.keys(yearl[year].summary).sort()){  
      yearl[year].summary[term].average = {};
      yearl[year].summary[term].count = {};
      yearl[year].summary[term].change = {};
      for (let group of Object.keys(yearl[year])){
        if (!(group == "summary") && Object.keys(yearl[year][group]).includes(term)){
          for (let subj of Object.keys(yearl[year][group][term].average)){
          if (!yearl[year].summary[term].average.hasOwnProperty(subj)){
            yearl[year].summary[term].average[subj] =
              yearl[year][group][term].average[subj] + 0;
            yearl[year].summary[term].count[subj] = 1;
          } else {
            yearl[year].summary[term].average[subj] +=
              yearl[year][group][term].average[subj];
            yearl[year].summary[term].count[subj] += 1;
          }
        }
        }
      }
      //Check if there's a previous term
      var prevsemester = semesterbefore(yearl[year].summary, term);
      //Divide total points by number of occurrances
      for (let subj of Object.keys(yearl[year].summary[term].average)){
        yearl[year].summary[term].average[subj] /=
          yearl[year].summary[term].count[subj];
      //If there is a previous term find the difference
        var diff = 0;
        if (prevsemester != false && yearl[year].summary[prevsemester].average[subj] != undefined){
          yearl[year].summary[term].change[subj] =  yearl[year].summary[term].average[subj] - yearl[year].summary[prevsemester].average[subj];
        } else {
          yearl[year].summary[term].change[subj] = null;
        }

      }
    }
  }
}

function sanitizenum(num, accuracy = 2){
  //Takes in a potential number and accuracy. If a number, round it to the given
  //accuracy. If not, return a blank string
  if (!isNaN(num) && num != null){
    return num.toFixed(accuracy);
  } else{
    return "";
  }
}

function makeclasstable(curclass, dataselector = sessionStorage.yTableDisplay){
  //This is very similar to makeyeartable It would be good to move some of this
  //repetition out to helper functions
  if (["0","1","2"].includes(dataselector)){
    //do nothing
  } else {
    dataselector = 0;
   sessionStorage.yTableDisplay = 0;
  }
  d3.select("#tablesettings").remove();
  //Make table display options
  //TODO - un hardcode these
  d3.select("#datasettings").append("table")
  .attr("id", "tablesettings")
  .attr("class", "tabs") //TODO - This doesn't work. I don't know why
  .html("<tr><td id='ts0' onclick='selectyeardatasetting(0)'>Display Average Merits</td>"
    .concat("<td id='ts1' onclick='selectyeardatasetting(1)'>Display Merit Change</td>",
      "<td id='ts2' onclick='selectyeardatasetting(2)'>Display Both</td></tr>"));
  var currDataSelection = document.getElementById("ts".concat(dataselector));
  currDataSelection.className = 'tabselected';


  var mysubs = getclasssubs(curclass);
  mysubs.unshift("Semester"); //Add "Semester" column to table 
    d3.select("#bigtable")
    .html("");

  var colspan = 1;
  if (dataselector == 2){
    colspan = 2;
    var mysubsdouble = [];
    for (let sub of mysubs){
      mysubsdouble.push(sub);
      mysubsdouble.push(sub.concat("1"));
    }
  }

  d3.select("#bigtable")
  .append("table")
  .attr("id", "yeartable")
  .append("tr")
  .attr("id", "tableheader")
  .selectAll("th")
  .data(mysubs).enter()
  .append("th")
  .text(function(d) {return d.concat("\t");})
  .attr("colspan", colspan);

  var tablerows = Object.keys(curclass).sort();
  //Kludge to fix problem with d3 where it only uses from the 2nd row of data

  //REMOVE THIS AND SORT ABOVE WHEN SUMMARIES ARE IMPLEMENTED
  tablerows.pop();

  tablerows.unshift("0000");


    if (dataselector == 0 || dataselector == 1){
  d3.select("#yeartable")
  .selectAll("tr")
  .data(tablerows.sort()).enter()
  .append("tr")
  .each(function(semester){
  d3.select(this)
  .selectAll("td")
  .data(mysubs).enter()
  .append("td")
  //Deal with data selector and sanitize data for output
  //Change this to a switch statement
  .html(function(currentsubj) {
  if (dataselector == 0){
  var ret = curclass[semester].average[currentsubj];
  ret = sanitizenum(ret);
  } else if (dataselector == 1){
  var ret = curclass[semester].change[currentsubj];
  ret = sanitizenum(ret);
  }
  if (currentsubj == "Semester") {
    return semester;}
  else {
    return ret;
      }
    })
  //Move colouring out to function
  .attr("class", function(currentsubj) {
    if (dataselector == 0){ //If showing Merits
    var ret = curclass[semester].average[currentsubj];
    if (!(ret == undefined)){ return "grade".concat(merittonum(ret));}
    else{return "";}
  } else if (dataselector == 1){//If showing change
    var ret = curclass[semester].change[currentsubj];
    if (!(ret == undefined)){ return "change".concat(changelvls(ret));}
    else{return "blankcell";}
  } else { ret = "";}
  });
  });
  }  else if (dataselector == 2){

    d3.select("#yeartable")
    .selectAll("tr")
    .data(tablerows.sort()).enter()
    .append("tr")
    .each(function(semester){
    d3.select(this)
    .selectAll("td")
    .data(mysubsdouble).enter()
    .append("td")
    //Deal with data selector and sanitize data for output
    //Change this to a switch statement
    .html(function(currentsubj) {
      if (currentsubj.slice(-1) != "1"){
        var ret = sanitizenum(curclass[semester].average[currentsubj]);      
      } else {
        var ret = sanitizenum(curclass[semester].change[currentsubj.slice(0,-1)]); 
      }
      if (currentsubj == "Semester") {
        return semester;}
      else {
        return ret;
      }
    })
    //Move colouring out to function
    .attr("class", function(currentsubj) {
      if (currentsubj.slice(-1) != "1"){
        var ret = sanitizenum(curclass[semester].average[currentsubj]);
        return "grade".concat(merittonum(ret));
      }else{
        var ret = sanitizenum(curclass[semester].change[currentsubj.slice(0,-1)]); 
        return "change".concat(changelvls(ret));
      
      }
  });
  });
  }
}

function makeyeartable(curyear, dataselector = sessionStorage.yTableDisplay){
  if (["0","1","2"].includes(dataselector)){
    //do nothing
  } else {
    dataselector = 0;
    sessionStorage.yTableDisplay = 0;
  }
  d3.select("#tablesettings").remove();
  //Make table display options
  //TODO - un hardcode these
  d3.select("#datasettings").append("table")
  .attr("id", "tablesettings")
  .html("<tr><td id='ts0' onclick='selectyeardatasetting(0)'>Display Average Merits</td>"
    .concat("<td id='ts1' onclick='selectyeardatasetting(1)'>Display Merit Change</td>",
      "<td id='ts2' onclick='selectyeardatasetting(2)'>Display Both</td></tr>"));

  var currDataSelection = document.getElementById("ts".concat(dataselector));
  currDataSelection.className = 'tabselected';

  var mysubs = getyearsubs(curyear);
  mysubs.unshift("Semester"); //Add "Semester" column to table 

  d3.select("#bigtable")
    .html("");

  var colspan = 1;
  if (dataselector == 2){
    colspan = 2;
    var mysubsdouble = [];
    for (let sub of mysubs){
      mysubsdouble.push(sub);
      mysubsdouble.push(sub.concat("1"));
    }
  }

  d3.select("#bigtable")
  .append("table")
  .attr("id", "yeartable")
  .append("tr")
  .attr("id", "tableheader")
  .selectAll("th")
  .data(mysubs).enter()
  .append("th")
  .text(function(d) {return d.concat("\t");})
  .attr("colspan", colspan);

  var tablerows = Object.keys(curyear.summary);
  //Kludge to fix problem with d3 where it only uses from the 2nd row of data
  tablerows.push("0000");

  if (dataselector == 0 || dataselector == 1){
  d3.select("#yeartable")
  .selectAll("tr")
  .data(tablerows.sort()).enter()
  .append("tr")
  .each(function(semester){
  d3.select(this)
  .selectAll("td")
  .data(mysubs).enter()
  .append("td")
  //Deal with data selector and sanitize data for output
  //Change this to a switch statement
  .html(function(currentsubj) {
  if (dataselector == 0){
  var ret = curyear.summary[semester].average[currentsubj];
  ret = sanitizenum(ret);
  } else if (dataselector == 1){
  var ret = curyear.summary[semester].change[currentsubj];
  ret = sanitizenum(ret);
  }
  if (currentsubj == "Semester") {
    return semester;}
  else {
    return ret;
      }
    })
  //Move colouring out to function
  .attr("class", function(currentsubj) {
    if (dataselector == 0){ //If showing Merits
    var ret = curyear.summary[semester].average[currentsubj];
    if (!(ret == undefined)){ return "grade".concat(merittonum(ret));}
    else{return "";}
  } else if (dataselector == 1){//If showing change
    var ret = curyear.summary[semester].change[currentsubj];
    if (!(ret == undefined)){ return "change".concat(changelvls(ret));}
    else{return "blankcell";}
  } else { ret = "";}
  });
  });
  }

  else if (dataselector == 2){

    d3.select("#yeartable")
    .selectAll("tr")
    .data(tablerows.sort()).enter()
    .append("tr")
    .each(function(semester){
    d3.select(this)
    .selectAll("td")
    .data(mysubsdouble).enter()
    .append("td")
    //Deal with data selector and sanitize data for output
    //Change this to a switch statement
    .html(function(currentsubj) {
      if (currentsubj.slice(-1) != "1"){
        var ret = sanitizenum(curyear.summary[semester].average[currentsubj]);      
      } else {
        var ret = sanitizenum(curyear.summary[semester].change[currentsubj.slice(0,-1)]); 
      }
      if (currentsubj == "Semester") {
        return semester;}
      else {
        return ret;
      }
    })
    //Move colouring out to function
    .attr("class", function(currentsubj) {
      if (currentsubj.slice(-1) != "1"){
        var ret = sanitizenum(curyear.summary[semester].average[currentsubj]);
        return "grade".concat(merittonum(ret));
      }else{
        var ret = sanitizenum(curyear.summary[semester].change[currentsubj.slice(0,-1)]); 
        return "change".concat(changelvls(ret));
      
      }
  });
  });
  }
}

function changelvls(change){
  //convert a difference in merit points to a 'level'. 
  //Currently largely arbitrary, based on simple analysys.
  //One day it would be nice for users to be able to pick their own levels.
  if (change < -2){
    return "m7";
  } else if (change < -1){
    return "m6";
  } else if (change < -0.5){
    return "m5";
  }else if (change < -0.3){
    return "m4";
  }else if (change < -0.2){
    return "m3";
  } else if (change < -0.1){
    return "m2";
  } else if (change < 0){
    return "m1";
  } else if (change == 0){
    return 0;
  } else if (change < 0.1){
    return 1;
  } else if (change < 0.2){
    return 2;
  } else if (change < 0.3){
    return 3;
  } else if (change < 0.5){
    return 4;
  } else if (change < 1){
    return 5;
  } else if (change < 2){
    return 6;
  } else {
    return 7;
  }
}

function getfailingstudentsfromclass(classl,semester = null, subject = null){
  var semestercheck = false;
  var failings = {};
    var students = Object.keys(classl);

    for (let student of Object.keys(classl)){
      var studentinlist = false;
      if (semester == null || semestercheck == true) { //Select last semester
        var semesters = Object.keys(classl[student].grades).sort();
        semester = semesters[semesters.length -1];
        semestercheck = true;
      }
      // F = 6
      // - = 8
      if (classl[student].grades[semester]){
      for (let subj of Object.keys(classl[student].grades[semester])){
        if (subject == null || subj == subject) {
          if ([6,8].includes(classl[student].grades[semester][subj])){
            if (!studentinlist){ //If student not in object, add them
              failings[classl[student].name] = {
                "class":classl[student].grades[semester].gradeclass
              };
              studentinlist = true;
            }
            failings[classl[student].name][subj] = classl[student].grades[semester][subj];
          }
        }
      }
    }
    }
  return failings;
}

function getfailingstudents(classl,depth,semester = null,subject = null){
  //Takes an object and the depth of the object.
  //Optionally limits to a list of subjects (defaults to all)
  //Optionally can check students who were failing in a previous semester 
  //(defaults to most recent)
  //Outputs 
  // failings: {class : {
  //                    student: [subjects] (student as name rather than id)
  //            }}
  //The list of 
 
  //Should also try and catch if given the wrong object and give a helpful
  //error?
  if (!["cohort","class"].includes(depth)) {
    throw "Not a valid depth in getfailingstudents()";
  } else if (depth == "class") { //passed object was single class
    var failings = getfailingstudentsfromclass(classl,semester,subject);
  } else if (depth == "cohort"){
    var failings = {};
    var classes = Object.keys(classl);
    for (let group of classes){
      var nextclass = getfailingstudentsfromclass(classl[group],semester,subject);
      Object.keys(nextclass).forEach(function(key) {failings[key] = nextclass[key];}); //Add all elements of nextclass to failings
    }
  }
  return failings;
}

function semesterbefore(item,semester){
  //takes item(class) object from yearl and the name of a semester
  //returns the previous semester if this is not the first semester
  //otherwise return false
  semesters = Object.keys(item);
  semesters.sort();
  if (semester != semesters[0]){
    return semesters[semesters.indexOf(semester) - 1];
  }
  else {
    return false;
  }
}

//Build preliminary page elements
var tabs = d3.select("#sstats")
         .append("div")
         .attr("id", "tabs");
//Should really generate this table
tabs.append("table")
    .attr("id","toptabs")
    .html("<tr><td onclick='makestudents()' id='studenttab'>Student</td>".concat(
      "<td onclick='makeyeargroup()' id='ygtab'>Year Group</td>",
      "<td onclick='makesubject()' id='subjtab'>Subject</td>",
      "<td onclick='maketeacher()' id='teachtab'>Teacher</td>",
      "<td onclick='makesummary()' id='sumtab'>Summary</td></tr>"));
var contents = d3.select("#sstats")
                 .append("div")
                 .attr("id", "sscontent");

//Generate classl and subjects on pageload
const checkclassl = new Promise(function(resolve,reject){
  if (classl != {}){
    makeclassl();
  }
  resolve(classl);
});