const https = require('https')
const fs = require('fs')
const _ = require('highland')
const htmlparser = require('htmlparser2')

const baseUrl = 'https://www.studentlawnotes.com/subject-list/'
let subjects = _()
let cases = _()
let recordings = _()

if (!fs.existsSync('audio-files')) {
    fs.mkdirSync('audio-files')
}

const parser = new htmlparser.Parser({
    onopentag: (name, attribs) => {
        if (name == 'a' && attribs.class == 'subject') {
            subjects.write(attribs.href)
        }
    },
}, { decodeEntities: true })

https.get(baseUrl, res => {
    res.pipe(parser)
})

subjects.each(subjUrl => {
    const subjParser = new htmlparser.Parser({
        onopentag: (name, attribs) => {
            if (name == 'a' && attribs.href) {
                if (attribs.href[0] !== '/' && attribs.href[0] !== '#' && attribs.href.substr(0,4) !== 'http') {
                    cases.write({ subjUrl, caseUrl: attribs.href })
                }
            }
        }
    })

    https.get(`${baseUrl}/${subjUrl}`, res => {
        res.pipe(subjParser)
    })
})

cases.each(({ subjUrl, caseUrl }) => {
    const caseParser = new htmlparser.Parser({
        onopentag: (name, attribs) => {
            if (name == 'audio') {
                recordings.write({
                    fileUrl: attribs.href,
                    subjUrl,
                    caseUrl
                })
            }
        }
    })

    https.get(`${baseUrl}/${subjUrl}/${caseUrl}`, res => {
        res.pipe(fileOut)
    })
})

recordings.each(({ fileUrl, subjUrl, caseUrl }) => {
    recordings.pause()
    console.log(`Downloading: '${subjUrl}-${caseUrl}.mp3`)
    const fileOut = fs.createWriteStream(`audio-files/${subjUrl}-${caseUrl}.mp3`)
    https.get(`${baseUrl}/${subjUrl}/${caseUrl}/${fileUrl}`, res => {
        res.pipe(fileOut)
        res.on('end', () => {
            recordings.resume()
        })
    })
})