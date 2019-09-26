/*
expected data structure for classl:
classl { "class": {
      | "studentid" : {
        | "name": name
        | "id": id
        | "grades" : {
          | "rowterm" : {
            | "gradeclass": 6A
            | "MU" : 3
            | "M2S" : "SPA"
            | "ML" : "RUS"
          }
        }
        | "merits" : {
      | tmerits : {        Total merits for term
        |"18HT" : 170,
        |"18VT" : 175}
      | tmaverage : {      Average merits for term
        |"18HT" : 17.5,
        |"18VT" : 17.7
      }
      | tmlangaverage : {  Average merits for languages }
      | tmaesaverage : {   Average merits for aesthetics }
      | tmsoaverage : {    Average merits for SO }
      | tmnoaverage : {    Average merits for NO }
      | tmcoreaverage : {  Average merits for core subjects}
        }
      }
  }
}
*/

/*
Currently, this has a different theory on filling in student grades than the
original:
This ONLY fills in missing grades given in the current year. The original will
fill down grades from the previous year to fill in gaps.
It also copies down if the grade is listed as '0' (some kind of mysterious
schoolsoft error) Which the original did not.
*/


var classl = {};
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
students = d3.tsv("infoblob.tsv");
function student(id, name, grades){
  this.id = id;
  this.name = name;
  this.grades = grades;
}

function makeclass(classl, row){
  classl[row.class] = {};
}

function makestudent(classl, row){
  name = row["fname"].concat(" ", row["lname"]);
  term = row["archiveid"].concat(row["term"]);
  grade = {};
  grade[term] = {};
  classl[row["class"]][row["studentid"]] = new student(row["studentid"],
                             name,
                             grade);
  classl[row["class"]][row["studentid"]]["grades"][term]["gradeclass"] =
    row["gradeclass"];
  classl[row["class"]][row["studentid"]]["grades"][term][row["gradesubject"]] =
    +row["gradeid"];
  if (["ML","M2"].includes(row["gradesubject"])) {
    classl[row["class"]][row["studentid"]]["grades"][term]
      [row["gradesubject"].concat("S")] =
        row["specialization"];
  }
}

function addgradetostudent(studentl, row){
  //check if term row exists:
  //Maybe this is something you're supposed to uses promises for?
  rowterm = row["archiveid"].concat(row["term"])
  if (Object.keys(studentl[row["studentid"]]["grades"]).includes(rowterm)){
    studentl[row["studentid"]]["grades"][rowterm][row["gradesubject"]] =
      +row["gradeid"];
  }else{
    studentl[row["studentid"]]["grades"][rowterm] =
      {"gradeclass": row["gradeclass"]};
    studentl[row["studentid"]]["grades"][rowterm][row["gradesubject"]] =
      +row["gradeid"];
  }
  if (["ML","M2"].includes(row["gradesubject"])){
    studentl[row["studentid"]]
      ["grades"]
      [rowterm]
      [row["gradesubject"].concat("S")] =
        row["specialization"];
  }
}

function filldowngrades(grades){
  //Fill down missing grades per term
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
  /* Sets #idselector to studentid of current student
  */
  selectindex = document.getElementById("studentSelector").selectedIndex
  document.getElementById("idSelector").selectedIndex = selectindex;
  currentclass = d3.select("#classSelector").property("value");
  currentstudent = d3.select("#idSelector").property("value");
  makestudenttable(classl[currentclass][currentstudent]);

  //Currently cheats to make graph.
  gdata = [];
  for (term of Object.keys(classl[currentclass][currentstudent]
      ["merits"]["tmaverage"]).sort()) {
    gdata.push({"x" : term,
          "y" : classl[currentclass][currentstudent]["merits"]
                        ["tmaverage"][term]});
  }
  makescattergraph(gdata);
}

function selectnewclass() {
  /* Changes students in student dropdown to those in selected class
     Changes id numbers in hidden idselector to those in selected class
     Blanks table
    requires: classl
    (should be fine, as only referred to by dropbox created after
    classl is loaded)
  */
  selectValue = d3.select("#classSelector").property("value");
  d3.select("#studentSelector")
    .selectAll("option")
    .remove();

  d3.select("#studentSelector")
    .append("option")
    .text("Select a student")

  keyslist = Object.keys(classl[selectValue]);

  d3.select("#studentSelector")
    .selectAll("option")
    .data(keyslist).enter()
    .append("option")
    .text(function(d) { return classl[selectValue][d]["name"];});

  d3.select("#idSelector")
    .selectAll("option")
    .remove();

  d3.select("#idSelector")
    .selectAll("option")
    .data(keyslist).enter()
    .append("option")
    .text(function(d) { return d});

  d3.select("#bigtable").html("");
  d3.select("#scatterplot").remove();
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
  }
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
  }
  if (grades[a] != undefined) {return grades[a];}
  else {return -1;}
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
          "tmcoreaverage" : {}}
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
        merits = gradetomerits(grades[term][subject])
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
      }
    }
    if (runcount != 0) {
      result["tmerits"][term] = meritsum
      result["tmaverage"][term] = meritsum/runcount;
      if (langcount != 0) {
        result["tmlangaverage"][term] = langsum/langcount;
      } else { result["tmlangaverage"][term] = 0; }
      if (aescount != 0){
        result["tmaesaverage"][term] = aessum/aescount;
      } else { result["tmaesaverage"][term] = 0;}
      if (socount != 0){
        result["tmsoaverage"][term] = sosum/socount;
      } else { result["tmsoaverage"][term] = 0;}
      if (nocount != 0){
        result["tmnoaverage"][term] = nosum/nocount;
      } else { result["tmnoaverage"][term] = 0;}
      if (corecount != 0){
        result["tmcoreaverage"][term] = coresum/corecount;
      } else { result["tmcoreaverage"][term] = 0}
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
      "TK" : 19}
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
  }
  if (a in meritsortorder && b in meritsortorder){
    return meritsortorder[a] - meritsortorder[b];
  } else if (a in meritsortorder) {
    return -1;
  } else if (b in meritsortorder) {
    return 1;
  } else {return 0;}
}

function gettableheaders(student){
  /* Gets list of subjects student has studied
  */
  var subjects = []
  for (var term in student.grades){
    subjects = subjects.concat(Object.keys(student["grades"][term]));
  }
  subjects_Set = new Set(subjects);
  subjects = [...subjects_Set];
  return subjects.sort(sortsubjectorder);
}

function makestudenttable(student){
  /*writes a table in the window with the student data in it.
  */
  mysubs = gettableheaders(student)

    d3.select("#bigtable").html("");

  d3.select("#bigtable")
  .append("table")
  .attr("id", "testtable")
  .append("tr")
  .attr("id", "tableheader")
  .selectAll("td")
  .data(mysubs).enter()
  .append("td")
  .text(function(d) {return d.concat("\t");})

  terms = Object.keys(student["grades"]).sort();

  // Make the table with grades and letters
  for (var i = 0; i < terms.length; i++) {
   d3.select("#testtable")
  .append("tr")
  .attr("id", "t".concat(terms[i])) //can't start ids with numbers
  .selectAll("td")
  .data(mysubs).enter()
  .append("td")
  .attr("class", function(d) {return "grade".concat(student["grades"]
  	[terms[i]][d]);})
  .text(function(d) {return gradenumtolet(student["grades"]
  	[terms[i]][d] , "\t");})
  
  //Write in merits
  termrow = d3.select("#t".concat(terms[i]))
  header = d3.select("#tableheader")
  
  for (var merithead of Object.keys(student["merits"]).sort(sortmeritorder)) {
    merit = student["merits"][merithead][terms[i]]
    if (merithead != "tmerits") {
      merit = merit.toFixed(2);
    }
    termrow.append("td")
    .text(merit);
  }
  }
  //Write headers for merit columns
  header.append("td").text("Merits");
  header.append("td").text("Av. Merits");
  header.append("td").text("Core Av.")
  header.append("td").text("Lang. Av.");
  header.append("td").text("Aes. Av.");
  header.append("td").text("SO Av.");
  header.append("td").text("NO Av.");
}

function makescattergraph(data){
  var margin = {top : 10, right: 30, bottom:30, left:60},
      width = 360 - margin.left - margin.right,
      height = 300 - margin.top - margin.bottom;
  // Clear the svg object

  d3.select("#scatterplot").remove();
  // append the svg object to the correct div object
  var svg = d3.select("#charts")
              .append("svg")
                .attr("id" , "scatterplot")
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
         .attr("x", -margin.top - height/2 + 60)
         .text("Average Merits")
      // Add path
      svg.append("path")
        .datum(data)
        .attr("fill", "none")
        .attr("stroke", "#69b3a2")
        .attr("stroke.width", 2)
        .attr("d", d3.line()
          .x(function(d) {return x(d.x)})
          .y(function(d) {return y(d.y)})
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
           .style("fill", "#69b3a2")
}


//Get list of students in each class and write to classl
//in the form above
students.then(function (result) {
  var currentstudent = []
  var studentl = [] //Cludge to prevent having to compare arrays
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
    };
  }));
  return 1;
}).then(function(classes) {

  for (let sclass of Object.keys(classl)) {
    for (let student of Object.keys(classl[sclass])) {
      var cstudent = classl[sclass][student]

      //Copy grades missing in VT to HT
      //There is surely some better way to do this?
      cstudent["grades"] = 
        filldowngrades(cstudent["grades"]);
      //Add merit average to student
      cstudent["merits"] = termmerits(cstudent["grades"])
    }
  }

}).then(function(classes) {
  

}).then(function(classes) { //Generate page elements
  var selectenv = d3.select("body")
    .append("div")
    .attr("id", "selectors");

  d3.select("body").append("div").attr("id", "bigtable");
  d3.select("body").append("div").attr("id", "charts");
  d3.select("#charts").append("span").attr("id","linegraphselect");
  d3.select("#linegraphselect").text("Line Graph");

  var classSelect = d3.select("#selectors")
    .append("select")
    .attr("id", "classSelector")
    .selectAll("option")
    .data(["Select a class"].concat(Object.keys(classl))).enter()
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

}).catch(console.log.bind(console));

console.log(classl);



