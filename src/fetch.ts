import * as fs from 'fs'
import fetch  from 'node-fetch'

type MontlyCrimeData = {
    [outcode: string] : {
        [crimeType: string]: {
            count: number,
            locations: {
                longitude: number,
                latitude: number
            }[]
        }
    }
}


const convert = async () => {
    const latLngCache:{[index:string]: string} = {}
    const crimeData: MontlyCrimeData = {}

    const months = [
        /* "2020-10", "2020-09", "2020-08", "2020-07", "2020-06", "2020-05", "2020-04", "2020-03", "2020-02", "2020-01",
        "2019-12", "2019-11", "2019-10", "2019-09", "2019-08", "2019-07", "2019-06", */ "2019-05", "2019-04", "2019-03", "2019-02", "2019-01",
        "2018-12", "2018-11", "2018-10", "2018-09", "2018-08", "2018-07", "2018-06", "2018-05", "2018-04", "2018-03", "2018-02", "2018-01",
    ]
    
    for (const date of months) {
        let jsonData: any = undefined
        while(!jsonData) {
            try {
                const response = await fetch(`https://data.police.uk/api/crimes-street/all-crime?poly=53.692,-2.736:53.302,-2.736:53.302,-1.921:53.692,-1.921&date=${date}`)
                jsonData = await response.json()
            } catch(e) {
                console.log(e)
                console.log('error-retrying')
                await new Promise(resolve => {
                    setTimeout(resolve, 5000)
                })
            }
        }
        console.log(date, jsonData.length)

        for(const row of jsonData) {

            const { category, location, month } = row 
            const { latitude, longitude } = location

            const latLngCacheKey = `${latitude}_${longitude}`
            if (!latLngCache[latLngCacheKey]) {
                let response:any = undefined
                while(!response) {
                    try {
                        response = await fetch(`http://localhost:8000/postcodes?lat=${latitude}&lon=${longitude}&radius=25000&limit=1`)
                    } catch (e) {
                        console.log('error-retrying')
                        await new Promise(resolve => {
                            setTimeout(resolve, 5000)
                        })
                    }
                }
                const data = await response.json()
                if (data && data.result && data.result.length > 0) {
                    const nearest = data.result[0]
                    const { outcode } = nearest
                    latLngCache[latLngCacheKey] = outcode
                    row['outcode'] = outcode
                }
            } else {
                row['outcode'] = latLngCache[latLngCacheKey]
            }


            const outcode = row['outcode']
            if (!crimeData[outcode]) {
                crimeData[outcode] = {}
            }

            const crimeType = category
            if (!crimeData[outcode][crimeType]) {
                crimeData[outcode][crimeType] = {
                    count: 0,
                    locations: []
                }
            }

            crimeData[outcode][crimeType].count ++
            crimeData[outcode][crimeType].locations.push({
                latitude,
                longitude
            })

            const output = JSON.stringify(crimeData, null, 2)
            const filename = `./output/${month}.json`
            fs.writeFileSync(filename, output) 

            process.stdout.write(".")
        }
        process.stdout.write("\n")

        // const output = JSON.stringify(crimeData, null, 2)
        // const filename = `./output/${month.replace(/rawdata\//g, '')}.json`
        // fs.writeFileSync(filename, output) 
    }
}

convert()


