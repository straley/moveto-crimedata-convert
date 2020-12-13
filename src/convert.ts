import * as fs from 'fs'
import * as path from 'path'
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

    const months = fs.readdirSync("./rawdata/").map(fileName => {
        return path.join("./rawdata/", fileName)
    })

    for (const month of months) {
        console.log(month)
        const files = fs.readdirSync(month).map(fileName => {
            return path.join(month, fileName)
        })
        
        for (const file of files) {
            console.log(file)
            const csv = fs.readFileSync(file)
            const lines = csv.toString().split(/\n/)
            const headings = lines.shift().split(/\s*,\s*/).map(col => col.replace(/\r/, ''))
            for (const line of lines) {
                const cols = lines.shift().split(/\s*,\s*/).map(col => col.replace(/\r/, ''))
                const row: {[index: string]: any} = {}
                for (const col in cols) {
                    row[headings[col]] = cols[col]
                }

                // for now only do Greater Manchester
                if (row["Falls within"] === "Greater Manchester Police") {
                    const latLngCacheKey = `${row.Latitude}_${row.Longitude}`
                    if (!latLngCache[latLngCacheKey]) {
                        const response = await fetch(`http://localhost:8000/postcodes?lat=${row.Latitude}&lon=${row.Longitude}&radius=25000&limit=1`)
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

                    const crimeType = row['Crime type'].toLowerCase().replace(/\s+/g, '-')
                    if (!crimeData[outcode][crimeType]) {
                        crimeData[outcode][crimeType] = {
                            count: 0,
                            locations: []
                        }
                    }

                    crimeData[outcode][crimeType].count ++
                    crimeData[outcode][crimeType].locations.push({
                        latitude: row["Latitude"],
                        longitude: row["Longitude"]
                    })

                    const output = JSON.stringify(crimeData, null, 2)
                    const filename = `./output/${month.replace(/rawdata\//g, '')}.json`
                    fs.writeFileSync(filename, output) 

                    process.stdout.write(".")
                }
            }
            process.stdout.write("\n")
        }

        // const output = JSON.stringify(crimeData, null, 2)
        // const filename = `./output/${month.replace(/rawdata\//g, '')}.json`
        // fs.writeFileSync(filename, output) 
    }
}

convert()


