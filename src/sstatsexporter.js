function exportstopdf(students){
	var doc = new jsPDF({
	orientation: 'landscape',
	unit: 'pt'
});
	//Takes an array of classes and id numbers
	//Exports their student pages to pdf
for (let student of students){
	let currentclass = student[0];
	let currentstudent = student[1];
  if (localStorage.carryDown == 1) {
    currstudent = JSON.parse(
    JSON.stringify(classl[currentclass][currentstudent]));
    currstudent.grades = carrydowngrades(currstudent.grades);
    currstudent.merits = termmerits(currstudent.grades);
    currstudent.advanced = advstats(currstudent);
  } else {
    currstudent = classl[currentclass][currentstudent];
  }
	makestudenttable(currstudent);
	makescattergraph(currstudent, 200, 200);
  	makestudentbargraph(currstudent, 200, 200);

	doc.getFontSize(18);
	doc.text(currentclass,10,10);
	doc.addPage();
	doc.getFontSize(10);
	doc.fromHTML(d3.select("#bigtable").html());
	doc.addSvgAsImage(d3.select("#barchart").html(), 10, 10, 200, 200);
	doc.addSvgAsImage(d3.select("#scatterplot").html(), 210,10,200,200);
	clearpage();
	}
	doc.save('a4.pdf');
}