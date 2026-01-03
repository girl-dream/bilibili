import options from "./options.js"
import readline from "node:readline/promises"
import wei from "./wei.js"
import { stdin as input, stdout as output } from "process"
import fs from "node:fs"
const r = readline.createInterface({ input, output, terminal: false })
import { execSync } from "node:child_process"
import { Readable } from "node:stream"
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { pipeline } from 'stream/promises'

class Download {
    #aid
    #bvid
    #cid
    #arrary = []
    #videoOptions = [
        { id: 127, name: '8K 超高清' },
        { id: 126, name: '杜比视界' },
        { id: 125, name: 'HDR 真彩色' },
        { id: 120, name: '4K 超清' },
        { id: 116, name: '1080P60 高帧率' },
        { id: 112, name: '1080P+ 高码率' },
        { id: 100, name: '智能修复' },
        { id: 80, name: '1080P 高清' },
        { id: 74, name: '720P60 高帧率' },
        { id: 64, name: '720P 高清' },
        { id: 32, name: '480P 清晰' },
        { id: 16, name: '360P 流畅' },
        { id: 6, name: '240P 极速' },
    ]
    #audioOptions = [
        { id: 30216, name: '64K' },
        { id: 30232, name: '132K' },
        { id: 30280, name: '192K' },
        { id: 30250, name: '杜比全景声' },
        { id: 30251, name: 'Hi-Res无损' }
    ]
    #codec = [
        { id: 7, name: 'AVC' },
        { id: 12, name: 'HEVC' },
        { id: 13, name: 'AV1' },
    ]
    #download_choose = {}
    #type
    #formats
    // 音频数据
    #audio_sid
    constructor(data) {
        if ('sid' in data) {
            // 此处处理音频
            this.#audio_sid = data.sid
        } else if ('list' in data) {
            this.#aid = data.aiv
            this.#bvid = data.bvid
            let arr = []
            for (let i = 0; i < data.list.length; i++) {
                arr.push({ cid: data.list[i].cid, part: data.list[i].part.replaceAll(/[\\\/:*?"<>|]/gm, '_') })
            }
            this.#cid = arr
        } else {
            for (let i = 0; i < data.length; i++) {
                this.#arrary.push({
                    aid: data[i].aid,
                    bvid: data[i].bvid,
                    cid: data[i].cid,
                    title: data[i].show_title.replaceAll(/[\\\/:*?"<>|]/gm, "_")
                })
            }
        }
    }

    model(data, fnval, qn, type) {
        if ('list' in data) {
            this.#video(fnval, qn)
        } else if ('sid' in data) {
            this.#audio(this.#audio_sid)
        } else {
            this.#bangumi(fnval, qn, type)
        }
    }

    // fnval 为 4048 为dash格式视频所有类型
    // fnval 为 1 为FLV/MP4格式视频
    async #video(fnval = 4048, qn = 127) {
        await this.#check_p(this.#cid, 'video')
        if (this.#cid[0]) {
            for (let i = 0; i < this.#cid.length; i++) {
                await this.#download(`https://api.bilibili.com/x/player/playurl?avid=${this.#aid}&cid=${this.#cid[i].cid}&qn=${qn}&type&otype=json&fnver=0&fnval=${fnval}&fourk=1&bvid=${this.#bvid}`, i)
            }
            console.log('全部下载完成')
        } else {
            console.log('下载失败')
        }
        process.exit()
    }

    // type 为 pgc 为番剧
    // 实际上番剧和课程共用
    async #bangumi(fnval = 4048, qn = 127, type = 'pgc') {
        await this.#check_p(this.#arrary, 'bangumi')
        if (this.#arrary[0]) {
            for (let i = 0; i < this.#arrary.length; i++) {
                await this.#download(`https://api.bilibili.com/${type}/player/web/v2/playurl?avid=${this.#arrary[i].aid}&bvid=${this.#arrary[i].bvid}&cid=${this.#arrary[i].cid}&qn=${qn}&fnver=0&fnval=${fnval}&fourk=1&support_multi_audio=true&from_client=BROWSER`,
                    i, false)
            }
            console.log('全部下载完成')
        } else {
            console.log('下载失败')
        }
        process.exit()
    }

    async #check_p(arg, video_type) {
        if (arg.length <= 1) return
        while (true) {
            let temp = await r.question('视频存在多p,请输入x-x下载\n示例:1-3:下载p1到p3\n直接Enter为下载全部\n单独数字为下载单p\n')

            // 直接回车 - 下载全部
            if (temp === '') {
                video_type === 'video' ? this.#cid = arg : this.#arrary = arg
                break
            }

            // 单独数字 - 下载单P
            if (!temp.includes('-')) {
                let num = Number(temp)
                if (num > 0 && num <= arg.length) {
                    video_type === 'video' ? this.#cid = [arg[num - 1]] : this.#arrary = [arg[num - 1]]
                    break
                }
                console.log('输入错误')
                continue
            }

            // x-x格式 - 下载范围
            let arr = temp.split('-')
            let start = Number(arr[0])
            let end = arr[1] ? Number(arr[1]) : start

            if (start > 0 && start <= arg.length && end <= arg.length && start <= end) {
                let result = arg.slice(start - 1, end)
                video_type === 'video' ? this.#cid = result : this.#arrary = result
                break
            }

            console.log('输入错误')
        }
    }

    //AJAX进度监控
    async #download_AJAX(url) {
        const resp = await fetch(url, options)
        const total = +resp.headers.get('content-length') //总的数据量
        let body = []
        const reader = resp.body.getReader()//可读流
        let loaded = 0//当前的数据量
        while (true) {
            const { done, value } = await reader.read()
            if (done) {
                break
            }
            loaded += value.length
            body.push(value)
            process.stdout.write(`\r下载中: ${Math.trunc(loaded / total * 100)}%`)
        }
        return Buffer.concat(body)
    }

    // 以流的方式下载 + 进度监控
    async #downloadStream(url, fileName) {
        const resp = await fetch(url, options)
        const total = +resp.headers.get('content-length')
        const filePath = join(dirname(fileURLToPath(import.meta.url)), fileName)
        let loaded = 0
        const writeStream = fs.createWriteStream(filePath)

        // 使用管道直接连接响应流和写入流
        const reader = resp.body.getReader()

        while (true) {
            const { done, value } = await reader.read()
            if (done) {
                break
            }
            loaded += value.length
            // 直接写入文件流
            if (!writeStream.write(value)) {
                // 如果写入缓冲区已满，等待 drain 事件
                await new Promise(resolve => writeStream.once('drain', resolve))
            }
            process.stdout.write(`\r下载中: ${Math.trunc(loaded / total * 100)}%`)
        }
        writeStream.end()
        console.log('\n下载完成')
    }


    //arg= true 为视频 arg= false 为番剧
    async #download(url, i, arg = true) {
        try {
            const res = await fetch(url, options).then(response => response.json())
            let data = (arg ? res.data : res.result.video_info)
            if (Object.getOwnPropertyNames(this.#download_choose).length === 0) {
                if (res.code === 0) {
                    if ('dash' in data) {
                        // 此处处理dash格式视频
                        await this.#choose_video(data)
                        await this.#choose_codecs(data)
                        await this.#choose_audio(data)
                    } else if ('durl' in data) {

                        // 目前哔哩哔哩支持mp4格式,避免未知格式提示警告
                        if (data.format !== 'mp4') {
                            console.warn('出现未知格式')
                        }

                        //  此处处理flv/mp4格式视频
                        let temp = data.durl
                        for (let i = 0; i < temp.length; i++) {
                            let video = await this.#download_AJAX(temp[i].url)
                            fs.writeFileSync(`./${this.#cid[i].part}.mp4`, video)
                        }
                        console.log('下载完成')
                        process.exit()

                    } else {
                        console.error('未知错误')
                        process.exit()
                    }
                } else {
                    console.log('获取信息失败')
                    process.exit()
                }
            }
            //检测选择是否符合视频
            await this.#check_choose(data)

            let video_choose_obj = data.dash.video
                .filter(item => item.id === this.#download_choose.video_quality)

            //确定视频后缀名
            this.#type = getVideoExtension(video_choose_obj[0].mimeType)
            this.#formats = this.#type

            this.#download_choose.url = video_choose_obj.find(item => item.codecid === this.#download_choose.codec_quality).baseUrl
            let temp
            console.log(`开始下载第${i + 1}个:${arg ? this.#cid[i].part : this.#arrary[i].title}`)

            await this.#downloadStream(this.#download_choose.url, 'video.m4s')
            console.log('\n下载音频')
            if (this.#download_choose.audio_quality == 30250) {
                //杜比全景声
                temp = data.dash.dolby.audio.find(item => item.id === this.#download_choose.audio_quality)
            } else if (this.#download_choose.audio_quality == 30251) {
                //Hi-Res无损
                temp = data.dash.flac.audio
            } else {
                temp = data.dash.audio.find(item => item.id === this.#download_choose.audio_quality)
            }
            await this.#downloadStream(temp.baseUrl, 'audio.m4s')

            console.log('\n开始合并')
            //避免文件名冲突
            let title = arg ? this.#cid[i].part : this.#arrary[i].title

            while (fs.existsSync(`${title}.${this.#type}`)) {
                title = (await r.question('文件名冲突,请输入新文件名:')).replaceAll(/[\\\/:*?"<>|]/gm, "_")
            }

            // 避免mp4不支持fLaC编码的情况
            if (this.#download_choose.audio_quality == 30251) {
                this.#type = 'mkv'
                this.#formats = 'matroska'
            }

            execSync(`ffmpeg -i video.m4s -i audio.m4s -c:v copy -c:a copy -f ${this.#formats} "${title}.${this.#type}"`, { stdio: 'ignore' })
            console.log('合并完成')
            fs.unlinkSync('./video.m4s')
            fs.unlinkSync('./audio.m4s')
        } catch (e) {
            console.error('出现错误', e)
        } finally {
            r.close()
            process.exit()
        }
    }

    async #choose_video(data) {
        let temp = new Set(data.dash.video.map(item => item.id))
        if (temp.size == 1) {
            this.#download_choose.video_quality = [...temp][0]
            return
        }
        temp = this.#videoOptions.filter(option => temp.has(option.id))
        temp.forEach(option => {
            console.log(`| ${option.id} | ${option.name} |`)
        })
        while (true) {
            let video_quality = Number(await r.question('请选择清晰度'))
            if (temp.find(item => item.id === video_quality)) {
                this.#download_choose.video_quality = video_quality
                break
            } else {
                console.log('输入错误')
            }
        }
    }

    async #choose_codecs(data) {
        let temp = data.dash.video
            .filter(item => item.id === this.#download_choose.video_quality)
            .map(item => item.codecid)

        //视频无多个编码格式情况
        if (temp.length == 1) {
            this.#download_choose.codec_quality = temp[0]
            console.log(`视频编码为${this.#codec.find(c => c.id === temp[0]).name}`)
            return
        }

        temp.forEach(item => {
            let codecInfo = this.#codec.find(c => c.id === item)
            console.log(`| ${codecInfo.id} | ${codecInfo.name} |`)
        })
        while (true) {
            let codec_quality = Number(await r.question('请选择编码格式'))
            if (temp.includes(codec_quality)) {
                this.#download_choose.codec_quality = codec_quality
                break
            } else {
                console.log('输入错误')
            }
        }
    }

    async #choose_audio(data) {
        let temp = new Set(data.dash.audio.map(item => item.id))
        if (temp.size == 1) {
            this.#download_choose.audio_quality = [...temp][0]
            return
        }
        temp = this.#audioOptions.filter(option => temp.has(option.id))
        temp.forEach(option => {
            console.log(`| ${option.id} | ${option.name} |`)
        })

        let flac = data?.dash?.flac?.audio, dolby = data?.dash?.dolby?.audio
        if (flac) {
            let temp = new Array(flac).map(item => item.id)
            temp = this.#audioOptions.filter(option => temp.includes(option.id))
            temp.forEach(option => {
                console.log(`| ${option.id} | ${option.name} |`)
            })
        }

        if (dolby) {
            let temp = dolby.map(item => item.id)
            temp = this.#audioOptions.filter(option => temp.includes(option.id))
            temp.forEach(option => {
                console.log(`| ${option.id} | ${option.name} |`)
            })
        }

        while (true) {
            let audio_quality = Number(await r.question('请选择音频清晰度'))
            if (temp.find(item => item.id === audio_quality) ||
                (flac && audio_quality === 30251) ||
                (dolby && audio_quality === 30250)) {
                this.#download_choose.audio_quality = audio_quality;
                break;
            }
            console.log('输入错误')
        }
    }

    async #check_choose(data) {
        //video
        let temp = [...new Set(data.dash.video.map(item => item.id))]
        if (!temp.includes(this.#download_choose.video_quality)) {
            console.log('需重新选择分辨率')
            await this.#choose_video(data)
        }

        //codec
        temp = [...new Set(data.dash.video.map(item => item.codecid))]
        if (!temp.includes(this.#download_choose.codec_quality)) {
            console.log('需重新选择编码')
            await this.#choose_codecs(data)
        }

        //audio
        temp = data.dash.audio.map(item => item.id)
        let flac = data?.dash?.flac?.audio, dolby = data?.dash?.dolby?.audio
        if (!temp.includes(this.#download_choose.audio_quality)) {
            if (!((flac && this.#download_choose.audio_quality === 30251) || (dolby && this.#download_choose.audio_quality === 30250))) {
                console.log('需重新选择音频')
                await this.#choose_audio(data)
            }
        }
    }

    // todo
    static async text_wei_video(cid, avid, bvid) {
        fetch(`https://api.bilibili.com/x/player/wbi/playurl?${await wei(
            cid, avid, bvid)}&qn=127&type&otype=json&fnver=0&fnval=4048&fourk=1`, options).
            then(res => res.json())
            .then(res =>
                console.log(res))
    }

    async #audio(sid) {
        const url = new URL('https://api.bilibili.com/audio/music-service-c/url')
        console.log('0\t流畅 128K\n' +
            '1\t标准 192K\n' +
            '2\t高品质 320K\n' +
            '3\t无损 FLAC （大会员）')
        let quality
        while (true) {
            quality = await r.question('请选择音频质量\n')
            if (['0', '1', '2', '3'].includes(quality)) {
                break
            } else {
                console.log('输入错误,请重新输入')
            }
        }
        url.search = new URLSearchParams({
            mid: 1,
            privilege: 2,
            quality: Number(quality),
            platform: 1,
            songid: sid
        })
        let response = await fetch(url, options).then(res => res.json())
        let data
        switch (response.code) {
            case 0:
                data = response.data
                break
            case 72000000:
                console.error('参数错误' + response.msg)
                break
            case 7201006:
                console.error(response.msg)
                break
            default:
                console.error(`错误:${response.code}\n${response.message}`)
                process.exit()
        }
        let title = data.title.replaceAll(/[\\\/:*?"<>|]/gm, "_")

        while (fs.existsSync(`${title}.m4a`)) {
            title = (await r.question('文件名冲突,请输入新文件名:')).replaceAll(/[\\\/:*?"<>|]/gm, "_")
        }

        let download_url = data.cdns[0]
        await this.#downloadStream(download_url, `${title}.m4a`)
        process.exit()
    }
}

function getVideoExtension(contentType) {
    const extensionMap = {
        'video/mp4': 'mp4',
        'video/x-matroska': 'mkv',
        'video/webm': 'webm',
        'video/`avi': 'avi',
        'video/x-msvideo': 'avi',
        'video/quicktime': 'mov',
        'video/mpeg': 'mpeg',
        'video/3gpp': '3gp',
        'video/ogg': 'ogv',
        'video/x-flv': 'flv',
        'video/mp2t': 'ts',
        'application/x-mpegURL': 'm3u8',
        'video/x-ms-wmv': 'wmv'
    }
    let extension = extensionMap[contentType.split(';')[0].toLowerCase().trim()]
    if (!extension){
        console.warn('未能匹配启用默认后缀')
        extension = 'm4a'
    }

    return extension
}

export default Download