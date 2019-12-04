/*Todo:
Trim whitespace from beginning/end of data
Currently carries down SVA if student transfers to Swedish - fix this or just
Tell the user?


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
  Current grade distribution
   - Also select per subject/Subject group
   - Show historical grade distribution

 Teacher:
  Show grade distribution by year/class
  Show grade change for current students

Subject : 
 Show grade percentages by subject
 Show grade change by subject

 Summary:
   Show students with:
      Both an F and an A
      Have a grade more than (some) SD away from their mean grade
         - Show only students who
      Bimodal grades
      Negative slope
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
var currstudent = {};
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
    localStorage["carryDown"] = 1;
  }else{
    localStorage["carryDown"] = 0;
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
  if (localStorage["carryDown"] == 1) {
    currstudent = JSON.parse(
    JSON.stringify(classl[currentclass][currentstudent]));
    currstudent["grades"] = carrydowngrades(currstudent["grades"]);
    currstudent["merits"] = termmerits(currstudent["grades"]);
    currstudent["advanced"] = advstats(currstudent);
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
    .text(function(d) {return classl[selectValue][d]["name"];});

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
  d3.select("#schartsettings").attr("hidden", "true");
  d3.select("#advancedinfo").html("");
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
      result["tmerits"][term] = meritsum;
      result["tmaverage"][term] = meritsum/runcount;
      result["tmlangaverage"][term] = divby0(langsum,langcount);
      result["tmaesaverage"][term] = divby0(aessum,aescount);
      result["tmsoaverage"][term] = divby0(sosum,socount);
    result["tmnoaverage"][term] = divby0(nosum,nocount);
      result["tmcoreaverage"][term] = divby0(coresum,corecount);
    } else {
      result["tmerits"][term] = 0;
      result["tmaverage"][term] = 0;
      result["tmlangaverage"][term] = 0;
      result["tmaesaverage"][term] = 0;
      result["tmsoaverage"][term] = 0;
      result["tmnoaverage"][term] = 0;
      result["tmcoreaverage"][term] = 0;
    }
  }
  //calculate subject averages and put into object
  for (let subj of Object.keys(mbysubjecttemp)) {
    result["mbysubject"][subj] = divby0(mbysubjecttemp[subj].total,
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

  terms = Object.keys(student["grades"]).sort();

  // Make the table with grades and letters
  for (var i = 0; i < terms.length; i++) {
   d3.select("#stutable")
  .append("tr")
  .attr("id", "t".concat(terms[i])) //can't start ids with numbers
  .selectAll("td")
  .data(mysubs).enter()
  .append("td")
  .attr("class", function(d) {return "grade".concat(student["grades"]
    [terms[i]][d]);})
  .text(function(d) {
    if (d != "Semester") {
    return gradenumtolet(student["grades"]
    [terms[i]][d] , "\t");}
    else {return terms[i];}
  });

  //Write in merits
  termrow = d3.select("#t".concat(terms[i]));
  header = d3.select("#tableheader");

  for (let merithead of Object.keys(student["merits"]).sort(sortmeritorder)) {
    if (merithead != "mbysubject") {
      merit = student["merits"][merithead][terms[i]];
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
      (getaveragesubjgrade(student["merits"]["mbysubject"],d,1)));})
    .text(function(d) {return getaveragesubjgrade(
      student["merits"]["mbysubject"],d);});

   //Add in average grade row

     stutable.append("tr")
     .selectAll("td")
     .data(mysubs)
     .enter()
     .append("td")
     .attr("class", function(d) {return "grade".concat(merittonum(
       getaveragesubjgrade(student["merits"]["mbysubject"],d,1)));})
      .text(function(d) {return merittolet(
        getaveragesubjgrade(student["merits"]["mbysubject"],d));});

  //Write headers for merit columns
  header.append("th").text("Merits");
  header.append("th").text("Av. Merits");
  header.append("th").text("Core Av.");
  header.append("th").text("Lang. Av.");
  header.append("th").text("Aes. Av.");
  header.append("th").text("SO Av.");
  header.append("th").text("NO Av.");
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
      ["merits"][datatype]).sort()) {
    data.push({"x" : term,
          "y" : student["merits"]
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

function makegradebarchart(data){
  //Takes an array of grade counts in form {x:count, y:"letter"} the order
  //[A,B,C,D,E,F,M,-] and makes a bar chart of them in the bar chart
  //container

  //Remove any previous chart
  d3.select("#barchart").remove();

  //Make bar chart
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

      // Make x axis
       var x = d3.scaleBand()
                .domain(data.map(function(d) {return d.x;}))
                .range([0,width])
                .padding(0.2);
        svg.append("g")
         .attr("transform", "translate(0," + height + ")")
         .call(d3.axisBottom(x))
         .selectAll("text")
           .style("text-anchor", "end") ;
      // Add y axis
         var maxval = d3.max(data, function(d) {return d.y;});

      // Make sensible number of ticks
        if (maxval > 20){
          var ticks = 20;
        } else {
          var ticks = maxval - 1;
        }


         var y = d3.scaleLinear()
                .domain([0,maxval])
                .range([ height, 0]);
        svg.append("g")
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

function getsummarygradecount(classl, depth, semester = null, subject = null){
  //Error checking
  if (!["cohort","class"].includes(depth)){
    throw "incorrect depth in function 'makesummarybargraph'";
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
      var semesters = Object.keys(classl[student].grades).sort()
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
  } else {
    var yearcount = [0,0,0,0,0,0,0,0,0];
    for (let group of Object.keys(classl)){
      yearcount = getsummarygradecount(classl[group], "classl", semester, subject);
      for (i=0; i < 9; i++){
        gradecounts[i] += yearcount[i];
      }
    }
  }
  var data = [];
  for (var i of [5,4,3,2,1,6,7,8]){ //Grades are in a stupid order in schoolsoft
    data.push({"x":gradenumtolet(i),"y":gradecounts[i]});
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

function makestudents() {
  //Clear contents div
  contents.html("");
  //Get list of students in each class and write to classl
  //in the form above

  students.then(function (result) { //Get initial information
    var studentl = []; //Cludge to prevent having to compare arrays
    Promise.all(result.map(function(row){
      if (row["fname"] != undefined) {
        if (row["class"] in classl){
          if (!studentl.includes(row["studentid"])) { //If the student is new
            makestudent(classl,row);
            studentl.push(row["studentid"]);
          }
          else{
            addgradetostudent(classl[row["class"]],row);
          }
        }else{
            makeclass(classl,row);
            makestudent(classl,row);
          studentl.push(row["studentid"]);
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
        cstudent["grades"] =
          filldownVTgrades(cstudent["grades"]);
        //Add merit average to student
        cstudent["merits"] = termmerits(cstudent["grades"]);
        cstudent["advanced"] = advstats(cstudent);
      }
    }
  }).then(function(classes) { //Generate page elements
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
    if (localStorage["carryDown"] == 1){
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
      yearl[item.slice(0,1)]["summary"] = {};
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
    if (localStorage["carryDown"] == 0){
    makeyearl(classl);
  } else {
    makeyearlCarry(classl);
  }
}

function makeyeargroup(){
  contents.html("");
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
    d3.select("#charts").append("div").attr("id","scatterplotcontainer");
    d3.select("#charts").append("div").attr("id","barchartcontainer");
    d3.select("#charts").append("div").attr("id","schartsettings")
      .attr("hidden", "true");
    d3.select("#sscontent").append("div").attr("id","advancedinfo");

    //Make pull down grades option
    var pulldowndata = d3.select("#datasettings").append("input")
    .attr("id", "cdselect")
    .attr("type", "checkbox");  
    d3.select("#datasettings").append("text").text("Carry down grades");
    if (localStorage["carryDown"] == 1){
      pulldowndata.attr("checked", true);
    } else {}
    d3.select("#cdselect").on("change", function(){
      if (d3.select("#cdselect").property("checked") == true){
        localStorage["carryDown"] = 1;
      } else {
        localStorage["carryDown"] = 0;
      }
      makecarriedyear();
      selectnewyearclass();});
}

function selectyeardatasetting(val){
  var theyear = d3.select("#yearSelector").property("value");
  var curyear = yearl[theyear];
  sessionStorage["yTableDisplay"] = val;
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
  var failings = getfailingstudents(classl[theclass],"class")
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
  makegradebarchart(getsummarygradecount(classl[theclass],"class"));
  }
}

function maketeacher(){
  contents.html("")
  contents.append("div")
          .text("Teacher")
}

function makesummary(){
  contents.html("")
  contents.append("div")
          .text("Summary");
}

function makesubject(){
  contents.html("");
  contents.append("div")
          .text("Subject");
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
                  delete yearl[year][item][semester].average[subj]
                }
                else {
                  yearl[year][item][semester].average[subj] =
                  yearl[year][item][semester].total[subj]/
                  yearl[year][item][semester].average[subj]
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
      yearl[year].summary[term]["average"] = {}
      yearl[year].summary[term]["count"] = {}
      yearl[year].summary[term]["change"] = {}
      for (let group of Object.keys(yearl[year])){
        if (!(group == "summary")){
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
  //accuracy. If not, return a blank strin
  if (!isNaN(num) && num != null){
    return num.toFixed(accuracy);
  } else{
    return "";
  }
}

function makeclasstable(curclass, dataselector = sessionStorage["yTableDisplay"]){
  //This is very similar to makeyeartable It would be good to move some of this
  //repetition out to helper functions
  if (["0","1","2"].includes(dataselector)){
    //do nothing
  } else {
    dataselector = 0;
   sessionStorage["yTableDisplay"] = 0;
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
  currDataSelection.className = 'ydsselected';


  var mysubs = getclasssubs(curclass);
  mysubs.unshift("Semester") //Add "Semester" column to table 
    d3.select("#bigtable")
    .html("")

  var colspan = 1;
  if (dataselector == 2){
    colspan = 2;
    var mysubsdouble = []
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

function makeyeartable(curyear, dataselector = sessionStorage["yTableDisplay"]){
  if (["0","1","2"].includes(dataselector)){
    //do nothing
  } else {
    dataselector = 0;
    sessionStorage["yTableDisplay"] = 0;
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
  currDataSelection.className = 'ydsselected';

  var mysubs = getyearsubs(curyear);
  mysubs.unshift("Semester"); //Add "Semester" column to table 

  d3.select("#bigtable")
    .html("")

  var colspan = 1;
  if (dataselector == 2){
    colspan = 2;
    var mysubsdouble = []
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
}}

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
    failings = getfailingstudentsfromclass(classl,semester,subject);
  } else if (depth == "cohort"){
    var failings = {};
    var classes = Object.keys(classl);
    for (let group of classes){
      var nextclass = getfailingstudentsfromclass(classl[group],semester,subject);
      Object.keys(nextclass).forEach(function(key) {failings[key] = nextclass[key];}) //Add all elements of nextclass to failings
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
    return semesters[semesters.indexOf(semester) - 1]
  }
  else {
    return false;
  }
}

var tabs = d3.select("#sstats")
         .append("div")
         .attr("id", "tabs");
//Should really generate this table
tabs.append("table")
    .attr("class","toptabs")
    .html("<tr><td onclick='makestudents()'>Student</td>".concat(
      "<td onclick='makeyeargroup()'>Year Group</td>",
      "<td onclick='makesubject()'>Subject</td>",
      "<td onclick='maketeacher()'>Teacher</td>",
      "<td onclick='makesummary()'>Summary</td></tr>"));
var contents = d3.select("#sstats")
                 .append("div")
                 .attr("id", "sscontent");
//Currently needs to start on students tab in order to generate data
makestudents();