import * as readline from 'node:readline/promises'
import { stdin as input, stdout as output } from 'node:process'
import check from "./check.js"
import get_info from "./info.js"
import download from "./download.js"
const r = readline.createInterface({ input, output, terminal: false })

    ; (async () => {
        let args = process.argv.slice(2)
        //检测ffmpeg
        check.check_ffmpeg()

        //判断用户状态
        await check.is_vip()
        let answer = await r.question('请输入url/bv/av/ep/md/ss/au\n课程无法单独使用ss/md,需要使用node -lesson\n')

        let fnval, qn, type
        if (args.includes('-fnval')) {
            fnval = 1
        } else if (args.includes('-qn')) {
            qn = args[args.indexOf('-qn') + 1]
        }
        if (args.includes('-lesson')) {
            console.log('启用课程下载')
            type = 'pugv'
        }

        //检查是否合法
        if (!(check.is_url(answer) || check.is_bv(answer) || /\b(ep|md|ss|au|av)\d+/i.test(answer))) {
            console.log('输入错误')
            process.exit()
        }

        let result = await get_info(answer, type)
        const downloader = new download(result)
        downloader.model(result, fnval, qn, type)
    })()
