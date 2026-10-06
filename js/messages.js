// 画面の文言（日本語・英語で同じキー）。t(key, vars, lang) で {name} を値に置き換える。globalThis.HashVizMessages に置く
// 文中の **…** は太字、改行（\n）は改行として i18n.js が要素で組み立てる（HTML として解釈しない）
(() => {
  'use strict';

  const ja = {
    'ui.subtitle': 'ハッシュ関数のアバランシェ効果と、研究で見つかった本物の衝突を、ビットの絵で確かめる教育用ツール',
    'ui.tabsLabel': '表示の切り替え',
    'ui.langButton': 'English',
    'ui.langLabel': 'Switch to English',
    'ui.noscript': 'このページはJavaScriptで動きます。JavaScriptを有効にしてから開き直してください。',
    'ui.repo': 'GitHubリポジトリー（ipusiron/hashviz）',
    'ui.listSep': '、',
    'ui.colon': '：',
    'ui.sentenceSep': '',
    'theme.toLight': 'ライトモードに切り替える',
    'theme.toDark': 'ダークモードに切り替える',

    'tab.avalanche': 'アバランシェ',
    'tab.viz': '可視化',
    'tab.collision': '衝突',
    'tab.glossary': '用語集',

    'label.input': '入力',
    'label.format': '入力の形式',
    'label.algo': 'アルゴリズム',
    'label.byte': '反転するバイトの位置',
    'label.bit': '反転するビットの位置（0〜7）',
    'label.inputA': '入力A',
    'label.inputB': '入力B',
    'label.sample': '衝突の組',
    'label.3d': '3Dで表示',
    'label.autoRotate': '自動で回す',
    'opt.text': 'テキスト（UTF-8）',
    'opt.hex': '16進',
    'opt.base64': 'Base64',
    'hint.byte': '0から数えます。テキストの場合はUTF-8に直したバイト列での位置です（日本語の1文字は3バイト）。',
    'hint.bit': '0が最下位ビット、7が最上位ビットです。',
    'hint.grid': '明るいマスが1、暗いマスが0です。マスを押すか、図を選んで矢印キーとEnterで、そのビットに印を付けられます。',
    'hint.3d': 'ドラッグか矢印キーで回せます。1のビットは大きな立方体、0のビットは小さな立方体で描きます。',
    'btn.prevBit': '前のビット',
    'btn.nextBit': '次のビット',
    'btn.randomBit': 'ランダムな位置',
    'btn.resetView': '向きを戻す',
    'btn.clearMarks': '印を消す',
    'btn.loadSample': '入力欄に入れる',

    'err.empty': '入力が空です。1バイト以上入れてください。',
    'err.byteRange': 'バイトの位置は0〜{max}の整数で指定してください。',
    'err.bitRange': 'ビットの位置は0〜7の整数で指定してください。',
    'err.hexOdd': '16進の桁数が奇数です（{digits}桁）。2桁で1バイトです。',
    'err.hexChar': '16進で使えない文字「{char}」があります。',
    'err.b64Char': 'Base64で使えない文字「{char}」があります。',
    'err.b64Length': 'Base64の長さが正しくありません。',
    'err.tooLong': '入力が長すぎます（{bytes}バイト。上限は{max}バイト）。',
    'err.nosubtle': 'このブラウザーではWeb Crypto（crypto.subtle）が使えないため、SHA系を計算できません。HTTPSのページか、手元のファイルとして開いてください。',
    'err.inputLabel': '{name}：{message}',

    'ava.title': 'アバランシェ効果',
    'ava.lead': '入力の1ビットだけを反転し、ダイジェスト（ハッシュ値）のビットがどれだけ変わるかを比べます。理想的なハッシュでは、**平均で半分のビットが変わります**。弱いハッシュ（ToyHash16）と比べると違いがわかります。',
    'ava.flipTitle': '反転した場所',
    'ava.colBefore': '反転前',
    'ava.colAfter': '反転後',
    'ava.rowByte': '{pos}バイト目',
    'ava.rowBits': 'ビット（左が7、右が0）',
    'ava.owner': 'このバイトは{index}文字目の「{char}」（{cp}、{bytes}バイトのうち{nth}バイト目）に当たります。',
    'ava.flippedText': '反転後の入力をUTF-8として読むと「{text}」です。',
    'ava.flippedInvalid': '反転後の入力は、UTF-8として正しくない並びになります（ハッシュの計算はバイト列のまま行います）。',
    'ava.digestA': '元の入力のダイジェスト',
    'ava.digestB': '反転後のダイジェスト',
    'ava.digestDiff': '違うビット（XOR）',
    'ava.diffCount': '違うビット：{d} / {n}（{pct}%）',
    'ava.theory': '理想的なハッシュなら平均{mean}ビット、約95%は{lo}〜{hi}ビットに入ります（二項分布B({n}, 1/2)）。',
    'ava.within': '理論の範囲の中です。',
    'ava.low': '理論の範囲より少なく、入力の変化が出力に広がっていません。',
    'ava.high': '理論の範囲より多くなっています。',
    'ava.chance': '理想的なハッシュでも、20回に1回ほどは範囲の外になります。何カ所か位置を変えて比べてください。',

    'viz.title': 'ハッシュ値の可視化',
    'viz.lead': 'ダイジェストのビットを上位から順に、左から右へ、行が終われば下の行へ並べます。入力を少し変えると、模様がまったく別のものになります。',
    'viz.digest': 'ダイジェスト（16進）',
    'viz.binary': '2進数で見る',
    'grid.selected': '印を付けたビット：{list}',
    'grid.none': '印を付けたビットはありません。',
    'grid.bit': '{i}番（{byte}バイト目の上から{nth}番目）',
    'grid.label': '{name}のビットの図（{algo}、{n}ビット）',
    'grid.label3d': '{name}のビットの3Dの図（{algo}、{n}ビット）',

    'stats.title': '統計',
    'stats.note': '1つのダイジェストの0と1の偏りを数えたもので、ハッシュの強さを示す数ではありません。',
    'stats.bits': 'ビット数',
    'stats.ones': '1の数',
    'stats.zeros': '0の数',
    'stats.entropy': '0と1の偏り（エントロピー、1ビットあたり）',
    'stats.runs': '同じビットの連続（runs）の数',
    'stats.maxRun': '最長の連続',
    'stats.bytes': 'バイト数',
    'stats.unique': '異なるバイト値の数',
    'stats.item': '項目',
    'stats.value': '値',

    'col.title': '衝突',
    'col.lead': '異なる2つの入力が同じダイジェストになることを衝突と呼びます。MD5とSHA-1は、研究で見つかった**本物の衝突の組**をこのページの中で計算して確かめられます。入力を1文字でも変えると、衝突は崩れます。',
    'col.sources': '出典：',
    'col.bytesSame': '2つの入力はまったく同じです。',
    'col.bytesDiff': '{len}バイト中{count}バイトが違います（0から数えた位置：{list}）。',
    'col.bytesDiffLen': '長さが違います（Aは{a}バイト、Bは{b}バイト）。違う位置は{count}カ所です。',
    'col.more': '…ほか{rest}カ所',
    'col.dumpA': '入力Aのバイト（違うところに印）',
    'col.dumpB': '入力Bのバイト（違うところに印）',
    'col.digestA': '入力Aのダイジェスト',
    'col.digestB': '入力Bのダイジェスト',
    'col.same': '同じダイジェスト（衝突）',
    'col.different': '違うダイジェスト',
    'col.allTitle': 'ほかのアルゴリズムでは',
    'col.colAlgo': 'アルゴリズム',
    'col.colResult': '結果',
    'col.sameShort': '同じ（衝突）',
    'col.diffShort': '違う',
    'col.allNote': '本物の衝突の組でも、ほかのアルゴリズムでは違うダイジェストになります。衝突は、アルゴリズムごとに狙って作られたものです。',
    'col.caution': 'MD5とSHA-1は衝突を作れるので、電子署名や改ざんの検知に使ってはいけません。',
    'sample.md5-wang2004': 'MD5：Wangらの衝突（2004年、128バイト）',
    'sample.md5-stevens2012': 'MD5：1ブロックだけの衝突（Stevens、2012年、64バイト）',
    'sample.md5-textcoll': 'MD5：文字列どうしの衝突（HashClash、72文字）',
    'sample.md5-textcoll128': 'MD5：文字列どうしの衝突（corkami、128文字）',
    'sample.sha1-shattered': 'SHA-1：SHAtteredの先頭320バイト（2017年）',
    'sample.toy-ab': 'ToyHash16：「AB」と0x83',
    'sample.toy-abc': 'ToyHash16：「ABC」と0xC6',
    'note.md5-wang2004': 'Wangらが2004年に示した、MD5の最初の衝突の組です。MD5の標準の初期値のまま、2ブロック（128バイト）の中の6バイトだけが違います。'
      + '当時は1時間ほどかかりましたが、2006年の改良で一般的なPCでも1分ほどになり、今は数秒で同じ種類の組を作れます。',
    'note.md5-stevens2012': '1ブロック（64バイト）だけで衝突する組で、違うのは2バイトです。2010年にXieとFengが最初の例を示し、2012年にStevensが別の方法で作りました（MD5の圧縮関数を約2^49.8回）。',
    'note.md5-textcoll': '印字できる文字だけでできた、72文字どうしの衝突です（22文字目のAとEだけが違う）。Stevensの「Project HashClash」の例で、'
      + 'corkamiの「collisions」にも入っています。最後のパディングまで含めて衝突しているので、後ろに同じ文字列を足すと崩れます。',
    'note.md5-textcoll128': '72文字の組と同じ方法（HashClashのtextcoll）で作られた、128文字どうしの衝突です（22文字目のAとEだけが違う）。'
      + 'corkamiの「collisions」に著作権フリーの例として入っています。2ブロック目のあとで内部状態がそろうので、後ろに同じ文字列を足しても衝突は保たれます。',
    'note.sha1-shattered': '2017年にGoogleとCWIが公表したSHA-1の最初の衝突（SHAttered）の、2つのPDFの先頭320バイトです。'
      + '192バイトまでは同じで、そのあとの128バイトの中の62バイトが違います。計算にはSHA-1を約2^63回（約922京回）、'
      + 'CPUで6,500年分、GPUで110年分を使いました。この後ろに同じ内容を足しても衝突は保たれます。',
    'note.toy-ab': 'ToyHash16はバイトの和を65536で割った余りです。「AB」は0x41＋0x42＝0x83なので、1バイトの0x83と同じ値になります。',
    'note.toy-abc': '「ABC」は0x41＋0x42＋0x43＝0xC6なので、1バイトの0xC6と同じ値になります。足し算の順番を変えても値が同じなので、並べ替えるだけでも衝突します。',

    'gl.title': '用語集',
    'gl.lead': 'ハッシュ関数と、このツールで扱う攻撃の用語です。',
    'gl.hash.term': 'ハッシュ関数（hash function）',
    'gl.hash.desc': '任意の長さのデータから、決まった長さの値（ダイジェスト）を計算する関数です。暗号学的ハッシュ関数には、一方向性・第二原像耐性・衝突耐性が求められ、データの完全性の確認や電子署名に使われます。',
    'gl.digest.term': 'ダイジェスト（digest、ハッシュ値）',
    'gl.digest.desc': 'ハッシュ関数の出力です。長さはアルゴリズムで決まり、MD5は128ビット、SHA-1は160ビット、SHA-256は256ビット、SHA-512は512ビットです。',
    'gl.avalanche.term': 'アバランシェ効果（avalanche effect）',
    'gl.avalanche.desc': '入力の1ビットを変えると、出力のビットの約半分が変わる性質です。より厳しい条件に、どの入力ビットを反転しても出力の各ビットが確率1/2で反転する「厳密なアバランシェ基準（SAC、'
      + 'WebsterとTavares、1985年）」があります。1回の試行で変わるビット数は二項分布に従うので、ちょうど50%にはなりません。',
    'gl.collision.term': '衝突（collision）',
    'gl.collision.desc': '異なる2つの入力が同じダイジェストになることです。入力の種類は出力の種類より多いので衝突は必ずありますが、安全なハッシュ関数では見つけることが計算量的に困難です。',
    'gl.collisionResistance.term': '衝突耐性（collision resistance）',
    'gl.collisionResistance.desc': '同じダイジェストになる2つの異なる入力を見つけることが困難である性質です。MD5とSHA-1は、これが破られています。',
    'gl.preimage.term': '一方向性（原像耐性、preimage resistance）',
    'gl.preimage.desc': 'ダイジェストから、そのダイジェストになる入力を見つけることが困難である性質です。',
    'gl.secondPreimage.term': '第二原像耐性（second-preimage resistance）',
    'gl.secondPreimage.desc': 'ある入力が与えられたとき、それと同じダイジェストになる別の入力を見つけることが困難である性質です。衝突耐性より弱い条件で、MD5でも実用的な攻撃は見つかっていません。',
    'gl.birthday.term': '誕生日攻撃（birthday attack）',
    'gl.birthday.desc': '誕生日のパラドックスを使って衝突を探す方法です。nビットのダイジェストなら、ランダムに試して最初の衝突が見つかるまでの回数の期待値は約√(π/2)・2^(n/2)回（約1.25×2^(n/2)回）です。',
    'gl.md.term': 'Merkle–Damgård構造',
    'gl.md.desc': 'メッセージを64バイトなどのブロックに区切り、内部状態（IHV）を1ブロックずつ更新していく構造です。MD5・SHA-1・SHA-2が使っています。2つの入力が同じ長さで、ブロックの区切りで内部状態がそろっていれば、'
      + '後ろに同じデータを足しても衝突は保たれます。',
    'gl.md5.term': 'MD5',
    'gl.md5.desc': '128ビットのハッシュ関数です。1991年にRivestが設計し、1992年にRFC 1321として公開されました。2004年に衝突が示され、今は数秒で衝突を作れます。電子署名や改ざんの検知に使ってはいけません。',
    'gl.sha1.term': 'SHA-1',
    'gl.sha1.desc': '160ビットのハッシュ関数です。2017年にSHAtteredで実際の衝突が示され、2020年には選択プレフィックス衝突（SHA-1 is a Shambles）も実現しました。'
      + '公的に信頼されるTLSサーバー証明書では、認証局による発行が2016年1月から禁止され、主要ブラウザーも2017年に信頼しなくなりました。NISTは2030年末までに使用を終える方針です。',
    'gl.sha2.term': 'SHA-2（SHA-256・SHA-512など）',
    'gl.sha2.desc': '現在広く使われているハッシュ関数の系列です。実際の衝突は見つかっていません。',
    'gl.sha3.term': 'SHA-3',
    'gl.sha3.desc': '2015年にNISTがFIPS 202として標準化したハッシュ関数です。SHA-2とは違うスポンジ構造（Keccak）を使います。ブラウザーのWeb Cryptoではまだ計算できないため、このツールでは扱っていません。',
    'gl.wang.term': 'Wangらの攻撃',
    'gl.wang.desc': '2004年に王小雲（Xiaoyun Wang）らが発表した、MD5などの衝突攻撃です。差分攻撃の一種で、MD5の標準の初期値のまま2ブロックの衝突の組を作ります。',
    'gl.shattered.term': 'SHAttered',
    'gl.shattered.desc': '2017年にGoogleとCWIが公表した、SHA-1の最初の衝突です。SHA-1を約2^63回（約922京回）計算し、CPUで6,500年分、GPUで110年分の計算を使いました。内容の違う2つのPDFが同じSHA-1になります。',
    'gl.chosenPrefix.term': '選択プレフィックス衝突（chosen-prefix collision）',
    'gl.chosenPrefix.desc': '2つの入力の先頭（プレフィックス）を攻撃者が自由に選び、その後ろに付けるデータを計算して衝突させる、より強い攻撃です。MD5では2007年に示され、SHA-1では2020年に実現しました（SHA-1 is a Shambles）。',
    'gl.flame.term': 'Flame',
    'gl.flame.desc': '2012年に見つかったマルウェアです。MD5の選択プレフィックス衝突の新しい変種を使い、Microsoftのライセンス用の認証局が署名した証明書と、'
      + 'コード署名に使える偽の証明書の署名対象を同じMD5にしました。そのため正規の署名が偽の証明書でもそのまま有効になり、Windows Updateを装って広がりました。',
    'gl.toy.term': 'ToyHash16',
    'gl.toy.desc': 'このツールのための教育用の弱いハッシュです。バイトの和を65536で割った余りを2バイトで返します。衝突は簡単に作れ、1ビットの反転で変わる出力ビットも平均2ビットほどしかありません。',
    'gl.hashvis.term': 'ハッシュの可視化（hash visualization）',
    'gl.hashvis.desc': 'ダイジェストのような意味のない並びを絵にして、人が見比べやすくする方法です。PerrigとSongが1999年に提案し、'
      + 'OpenSSHの「randomart」（VisualHostKey）はこれを元にしています。絵が違えば鍵が違うとわかりますが、似て見えても同じとは限りません。',

    'name.inputA': '元の入力',
    'name.inputB': '反転後',
    'name.diff': '違うビット',
    'name.viz': '入力',
    'name.colA': '入力A',
    'name.colB': '入力B'
  };

  const en = {
    'ui.subtitle': 'An educational tool for checking the avalanche effect of hash functions, '
      + 'and real collisions found by researchers, as pictures of bits',
    'ui.tabsLabel': 'Views',
    'ui.langButton': '日本語',
    'ui.langLabel': '日本語に切り替える',
    'ui.noscript': 'This page needs JavaScript. Please enable JavaScript and reload.',
    'ui.repo': 'GitHub repository (ipusiron/hashviz)',
    'ui.listSep': ', ',
    'ui.colon': ': ',
    'ui.sentenceSep': ' ',
    'theme.toLight': 'Switch to light mode',
    'theme.toDark': 'Switch to dark mode',

    'tab.avalanche': 'Avalanche',
    'tab.viz': 'Visualize',
    'tab.collision': 'Collisions',
    'tab.glossary': 'Glossary',

    'label.input': 'Input',
    'label.format': 'Input format',
    'label.algo': 'Algorithm',
    'label.byte': 'Byte to flip',
    'label.bit': 'Bit to flip (0-7)',
    'label.inputA': 'Input A',
    'label.inputB': 'Input B',
    'label.sample': 'Collision pair',
    'label.3d': 'Show in 3D',
    'label.autoRotate': 'Rotate automatically',
    'opt.text': 'Text (UTF-8)',
    'opt.hex': 'Hex',
    'opt.base64': 'Base64',
    'hint.byte': 'Counted from 0. For text, this is the position in the UTF-8 bytes (one Japanese character is three bytes).',
    'hint.bit': '0 is the least significant bit and 7 the most significant.',
    'hint.grid': 'Light cells are 1 and dark cells are 0. Click a cell, or focus the picture and use the arrow keys and Enter, to mark that bit.',
    'hint.3d': 'Drag or use the arrow keys to rotate. 1 bits are drawn as large cubes and 0 bits as small cubes.',
    'btn.prevBit': 'Previous bit',
    'btn.nextBit': 'Next bit',
    'btn.randomBit': 'Random position',
    'btn.resetView': 'Reset view',
    'btn.clearMarks': 'Clear marks',
    'btn.loadSample': 'Put into the inputs',

    'err.empty': 'The input is empty. Enter at least one byte.',
    'err.byteRange': 'The byte position must be a whole number from 0 to {max}.',
    'err.bitRange': 'The bit position must be a whole number from 0 to 7.',
    'err.hexOdd': 'The hex has an odd number of digits ({digits}). Two digits make one byte.',
    'err.hexChar': 'The hex contains a character that is not allowed: "{char}".',
    'err.b64Char': 'The Base64 contains a character that is not allowed: "{char}".',
    'err.b64Length': 'The Base64 has an invalid length.',
    'err.tooLong': 'The input is too long ({bytes} bytes; the limit is {max} bytes).',
    'err.nosubtle': 'Web Crypto (crypto.subtle) is not available in this browser, '
      + 'so the SHA family cannot be computed. Open the page over HTTPS or as a local file.',
    'err.inputLabel': '{name}: {message}',

    'ava.title': 'Avalanche effect',
    'ava.lead': 'Flip a single bit of the input and see how many bits of the digest (hash value) change. '
      + 'With an ideal hash, **half of the bits change on average**. '
      + 'Compare with a weak hash (ToyHash16) to see the difference.',
    'ava.flipTitle': 'What was flipped',
    'ava.colBefore': 'Before',
    'ava.colAfter': 'After',
    'ava.rowByte': 'Byte {pos}',
    'ava.rowBits': 'Bits (7 on the left, 0 on the right)',
    'ava.owner': 'This byte belongs to character {index}, "{char}" ({cp}), and is byte {nth} of its {bytes}.',
    'ava.flippedText': 'Read as UTF-8, the flipped input is "{text}".',
    'ava.flippedInvalid': 'The flipped input is not valid UTF-8 (the hash is computed on the bytes as they are).',
    'ava.digestA': 'Digest of the original input',
    'ava.digestB': 'Digest after the flip',
    'ava.digestDiff': 'Bits that differ (XOR)',
    'ava.diffCount': 'Bits that differ: {d} / {n} ({pct}%)',
    'ava.theory': 'With an ideal hash, the average is {mean} bits and about 95% of results fall within {lo}-{hi} bits (binomial distribution B({n}, '
      + '1/2)).',
    'ava.within': 'This is within the expected range.',
    'ava.low': 'This is below the expected range: the change in the input does not spread through the output.',
    'ava.high': 'This is above the expected range.',
    'ava.chance': 'Even an ideal hash falls outside the range about once in 20 tries. Try a few other positions.',

    'viz.title': 'Hash visualization',
    'viz.lead': 'The bits of the digest are laid out from the most significant bit, '
      + 'left to right, then on to the next row. A small change in the input gives a completely different pattern.',
    'viz.digest': 'Digest (hex)',
    'viz.binary': 'Show in binary',
    'grid.selected': 'Marked bits: {list}',
    'grid.none': 'No bits are marked.',
    'grid.bit': '#{i} (byte {byte}, bit {nth} from the top)',
    'grid.label': 'Bits of {name} ({algo}, {n} bits)',
    'grid.label3d': 'Bits of {name} in 3D ({algo}, {n} bits)',

    'stats.title': 'Statistics',
    'stats.note': 'These count how 0s and 1s are spread within one digest. They do not measure the strength of the hash.',
    'stats.bits': 'Bits',
    'stats.ones': 'Ones',
    'stats.zeros': 'Zeros',
    'stats.entropy': 'Balance of 0s and 1s (entropy per bit)',
    'stats.runs': 'Runs of the same bit',
    'stats.maxRun': 'Longest run',
    'stats.bytes': 'Bytes',
    'stats.unique': 'Distinct byte values',
    'stats.item': 'Item',
    'stats.value': 'Value',

    'col.title': 'Collisions',
    'col.lead': 'A collision is two different inputs with the same digest. '
      + 'For MD5 and SHA-1 you can compute **real collision pairs found by researchers** right in this page. '
      + 'Change even one character of an input and the collision breaks.',
    'col.sources': 'Sources: ',
    'col.bytesSame': 'The two inputs are identical.',
    'col.bytesDiff': '{count} of {len} bytes differ (positions counted from 0: {list}).',
    'col.bytesDiffLen': 'The lengths differ (A is {a} bytes, B is {b} bytes). {count} positions differ.',
    'col.more': '... and {rest} more',
    'col.dumpA': 'Bytes of input A (differences marked)',
    'col.dumpB': 'Bytes of input B (differences marked)',
    'col.digestA': 'Digest of input A',
    'col.digestB': 'Digest of input B',
    'col.same': 'Same digest (collision)',
    'col.different': 'Different digests',
    'col.allTitle': 'With the other algorithms',
    'col.colAlgo': 'Algorithm',
    'col.colResult': 'Result',
    'col.sameShort': 'Same (collision)',
    'col.diffShort': 'Different',
    'col.allNote': 'Even a real collision pair gives different digests with the other algorithms. Each collision was crafted for one algorithm.',
    'col.caution': 'Collisions can be made for MD5 and SHA-1, so do not use them for digital signatures or tamper detection.',
    'sample.md5-wang2004': 'MD5: Wang et al. (2004, 128 bytes)',
    'sample.md5-stevens2012': 'MD5: single-block collision (Stevens, 2012, 64 bytes)',
    'sample.md5-textcoll': 'MD5: two printable strings (HashClash, 72 characters)',
    'sample.md5-textcoll128': 'MD5: two printable strings (corkami, 128 characters)',
    'sample.sha1-shattered': 'SHA-1: first 320 bytes of SHAttered (2017)',
    'sample.toy-ab': 'ToyHash16: "AB" and 0x83',
    'sample.toy-abc': 'ToyHash16: "ABC" and 0xC6',
    'note.md5-wang2004': 'The first MD5 collision, shown by Wang et al. in 2004. '
      + 'It uses the standard MD5 initial value, and only 6 of the 128 bytes (two blocks) differ. '
      + 'It took about an hour back then; improvements in 2006 brought it to about a minute on an ordinary PC, '
      + 'and today a pair of this kind takes seconds.',
    'note.md5-stevens2012': 'A collision within a single 64-byte block; only 2 bytes differ. '
      + 'Xie and Feng gave the first example in 2010, and Stevens found this one in 2012 with a different method (about 2^49.8 MD5 compressions).',
    'note.md5-textcoll': 'Two 72-character strings made only of printable characters (only the 22nd character differs, '
      + 'A and E). It is an example from Stevens\'s Project HashClash and is also in corkami\'s "collisions". '
      + 'The collision includes the final padding, so appending the same text to both breaks it.',
    'note.md5-textcoll128': 'Two 128-character strings that collide, made the same way as the 72-character pair (HashClash textcoll); '
      + 'only the 22nd character differs, A and E. It is in corkami\'s "collisions" as a copyright-free example. '
      + 'The internal states agree after the second block, so appending the same text to both keeps the collision.',
    'note.sha1-shattered': 'The first 320 bytes of the two PDFs of SHAttered, the first SHA-1 collision, '
      + 'announced by Google and CWI in 2017. The first 192 bytes are identical, '
      + 'and 62 bytes differ within the next 128. The attack took about 2^63 SHA-1 computations (about 9.2 quintillion): 6,500 CPU years and 110 GPU years. '
      + 'Appending the same content to both keeps the collision.',
    'note.toy-ab': 'ToyHash16 is the sum of the bytes modulo 65536. "AB" is 0x41 + 0x42 = 0x83, so it equals the single byte 0x83.',
    'note.toy-abc': '"ABC" is 0x41 + 0x42 + 0x43 = 0xC6, so it equals the single byte 0xC6. '
      + 'The order of the bytes does not change the sum, so even reordering them gives a collision.',

    'gl.title': 'Glossary',
    'gl.lead': 'Terms for hash functions and for the attacks covered by this tool.',
    'gl.hash.term': 'Hash function',
    'gl.hash.desc': 'A function that computes a fixed-length value (the digest) from data of any length. '
      + 'A cryptographic hash function must be one-way and resistant to second preimages and collisions; '
      + 'it is used to check data integrity and in digital signatures.',
    'gl.digest.term': 'Digest (hash value)',
    'gl.digest.desc': 'The output of a hash function. Its length depends on the algorithm: 128 bits for MD5, '
      + '160 for SHA-1, 256 for SHA-256 and 512 for SHA-512.',
    'gl.avalanche.term': 'Avalanche effect',
    'gl.avalanche.desc': 'The property that changing one input bit changes about half of the output bits. '
      + 'A stricter condition is the Strict Avalanche Criterion (SAC; '
      + 'Webster and Tavares, 1985): flipping any single input bit flips each output bit with probability 1/2. '
      + 'The number of bits that change in one try follows a binomial distribution, so it is rarely exactly 50%.',
    'gl.collision.term': 'Collision',
    'gl.collision.desc': 'Two different inputs with the same digest. There are more possible inputs than outputs, '
      + 'so collisions always exist, but for a secure hash function finding one is computationally infeasible.',
    'gl.collisionResistance.term': 'Collision resistance',
    'gl.collisionResistance.desc': 'The property that it is hard to find two different inputs with the same digest. It is broken for MD5 and SHA-1.',
    'gl.preimage.term': 'One-wayness (preimage resistance)',
    'gl.preimage.desc': 'The property that, given a digest, it is hard to find an input with that digest.',
    'gl.secondPreimage.term': 'Second-preimage resistance',
    'gl.secondPreimage.desc': 'The property that, given an input, it is hard to find another input with the same digest. '
      + 'It is weaker than collision resistance, and no practical attack is known even for MD5.',
    'gl.birthday.term': 'Birthday attack',
    'gl.birthday.desc': 'Finding a collision using the birthday paradox. For an n-bit digest, '
      + 'the expected number of random tries until the first collision is about √(π/2)·2^(n/2) (about 1.25 × 2^(n/2)).',
    'gl.md.term': 'Merkle–Damgård construction',
    'gl.md.desc': 'A construction that splits the message into blocks (such as 64 bytes) and updates an internal state (IHV) one block at a time. '
      + 'MD5, SHA-1 and SHA-2 use it. If two inputs have the same length and their internal states agree at a block boundary, '
      + 'appending the same data to both keeps the collision.',
    'gl.md5.term': 'MD5',
    'gl.md5.desc': 'A 128-bit hash function, designed by Rivest in 1991 and published as RFC 1321 in 1992. '
      + 'Collisions were shown in 2004, and today one can be made in seconds. '
      + 'Do not use it for digital signatures or tamper detection.',
    'gl.sha1.term': 'SHA-1',
    'gl.sha1.desc': 'A 160-bit hash function. SHAttered showed a real collision in 2017, '
      + 'and a chosen-prefix collision followed in 2020 (SHA-1 is a Shambles). '
      + 'For publicly trusted TLS server certificates, certificate authorities have been barred from issuing SHA-1 certificates since January 2016, '
      + 'and the major browsers stopped trusting them in 2017. NIST plans to phase out SHA-1 by the end of 2030.',
    'gl.sha2.term': 'SHA-2 (SHA-256, SHA-512 and others)',
    'gl.sha2.desc': 'The family of hash functions in wide use today. No real collision has been found.',
    'gl.sha3.term': 'SHA-3',
    'gl.sha3.desc': 'A hash function standardized by NIST as FIPS 202 in 2015. '
      + 'It uses a sponge construction (Keccak), unlike SHA-2. '
      + 'Web Crypto in browsers cannot compute it yet, so this tool does not cover it.',
    'gl.wang.term': 'Wang et al.\'s attack',
    'gl.wang.desc': 'A collision attack on MD5 and other hash functions, '
      + 'announced by Xiaoyun Wang et al. in 2004. A kind of differential attack, '
      + 'it builds a two-block collision pair from the standard MD5 initial value.',
    'gl.shattered.term': 'SHAttered',
    'gl.shattered.desc': 'The first SHA-1 collision, announced by Google and CWI in 2017. '
      + 'It took about 2^63 SHA-1 computations (about 9.2 quintillion): 6,500 CPU years and 110 GPU years. '
      + 'Two PDFs with different content have the same SHA-1.',
    'gl.chosenPrefix.term': 'Chosen-prefix collision',
    'gl.chosenPrefix.desc': 'A stronger attack in which the attacker freely chooses the beginnings (prefixes) of two inputs '
      + 'and computes the data appended to each to make them collide. '
      + 'It was shown for MD5 in 2007 and achieved for SHA-1 in 2020 (SHA-1 is a Shambles).',
    'gl.flame.term': 'Flame',
    'gl.flame.desc': 'Malware discovered in 2012. Using a new variant of an MD5 chosen-prefix collision, '
      + 'it gave a certificate signed by a Microsoft licensing certificate authority '
      + 'and a forged certificate usable for code signing the same MD5 over the signed part. '
      + 'The genuine signature was therefore valid on the forged certificate too, '
      + 'and Flame spread by posing as Windows Update.',
    'gl.toy.term': 'ToyHash16',
    'gl.toy.desc': 'A weak hash made for teaching in this tool. It returns the sum of the bytes modulo 65536 as two bytes. '
      + 'Collisions are easy to make, and flipping one input bit changes only about 2 output bits on average.',
    'gl.hashvis.term': 'Hash visualization',
    'gl.hashvis.desc': 'Turning meaningless strings such as digests into pictures so that people can compare them more easily. '
      + 'Perrig and Song proposed it in 1999, and OpenSSH\'s "randomart" (VisualHostKey) is based on it. '
      + 'Different pictures mean different keys, but pictures that look alike are not necessarily the same.',

    'name.inputA': 'the original input',
    'name.inputB': 'the flipped input',
    'name.diff': 'the differing bits',
    'name.viz': 'the input',
    'name.colA': 'input A',
    'name.colB': 'input B'
  };

  const MESSAGES = { ja, en };

  function t(key, vars = {}, lang) {
    const dict = MESSAGES[lang || (globalThis.HashVizI18n && globalThis.HashVizI18n.lang) || 'ja'] || ja;
    let text = Object.prototype.hasOwnProperty.call(dict, key) ? dict[key] : key;
    for (const [k, v] of Object.entries(vars)) text = text.split(`{${k}}`).join(String(v));
    return text;
  }

  globalThis.HashVizMessages = { MESSAGES, t };
})();
