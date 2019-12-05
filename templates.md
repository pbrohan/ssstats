# Templates for datatypes

## List of session/localStorage settings and uses

| Variable name | Type| Description | Session/Local | Implemented |
|---- | ---- | ---- | ---- | ---- |
| `carryDown` | Boolean | `True` if grades should be carried down. `False` otherwise | Local | yes |
| `sChartShowValues` | Boolean | `True` if point values should be shown on student charts. `False` otherwise | Local | **no**|
| `sChartDisplayTitle`| Boolean | `True` if title should be displayed on student charts. `False` otherwise | Local | **no** |
| `sChartAvMerits` | Boolean | `True` if Average merits should be displayed on student charts. `False` otherwise | Session | **no**|
| `sChartCoreMerits` | Boolean | `True` if Core merits should be displayed on student charts. `False` otherwise | Session | **no** |
| `sChartLangMerits` | Boolean | `True` if Language merits should be displayed on student charts. `False` otherwise | Session | **no** |
| `sChartAesMerits` | Boolean | `True` if Aestherics merits should be displayed on student charts. `False` otherwise | Session | **no** |
| `sChartSOMerits` | Boolean | `True` if SO merits should be displayed on student charts. `False` otherwise | Session | **no** |
| `sChartNOMerits` | Boolean | `True` if NO merits should be displayed on student charts. `False` otherwise | Session | **no** |
| `yTableDisplay` | Int | `0`  if displaying Average merits<br>`1` if displaying Merit change<br>`2` if displaying both together | Session | yes |
| `yBarChartType` | Str | `bar` if normal bar chart of grades, `stacked` if stacked grades over time | Session | yes |
---
## Expected data structure for `classl`
~~~
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
~~~
---
## Expected data structure for `yearl`
~~~
yearl{ "year" {
   | "class" {
    | "semester" : {
      | "total" : {
        | "subject" : total merits for class in subject and subject group
                  }
      | "average" : {
              | "subject" : average merit for class in subject and subject group
                      }
      }
      | "change" : {
        | "subject" : if a subject existed in a previous year, change in
                      average merit
                       }
      }
                     }
    }
    | "summary : {
      | "total" : {
        | "subject" : total merits for class in subject and subject group
                  }
      | "average" : {
              | "subject" : average merit for class in subject and subject group
                      }
      }
      | "change" : {
        | "subject" : if a subject existed in a previous year, change in
                      average merit
                       }
      }
                     }
    }"

   }
   | "summary" {
      | "total" : {
        | "subject" : total merits for class in subject and subject group
                  }
      | "average" : {
              | "subject" : average merit for class in subject and subject group
                      }
      }
      | "change" : {
        | "subject" : if a subject existed in a previous year, change in
                      average merit
                       }
      }
                     }
    }
    | "summary : {
      | "total" : {
        | "subject" : total merits for class in subject and subject group
                  }
      | "average" : {
              | "subject" : average merit for class in subject and subject group
                      }
      }
      | "change" : {
        | "subject" : if a subject existed in a previous year, change in
                      average merit
                       }
      }
                     }
    }"
}
}
~~~