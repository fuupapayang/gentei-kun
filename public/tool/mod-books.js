/* mod-books.js - ブック/スライド用の生成コンテンツ */
(function () {
  const T = window.T;
  const name = () => T.prop.name;
  const IMG = {
    day: () => T.art.facade('day'), dusk: () => T.art.facade('dusk'), night: () => T.art.facade('night'),
    zoom: () => T.art.facade('dusk', { t: 'translate(-400 -330) scale(1.5)' }),
    room: (f) => () => T.art.room(f),
    entr: () => T.photo('top_design_2.png', { alt: 'エントランス' }), lounge: () => T.photo('top_design_1.png', { alt: 'ラウンジ' }),
    loca: () => T.photo('top_loca_1.jpg', { alt: '周辺環境' }), nav: () => T.photo('common_nav_img.jpg', { alt: '葉山の夕景' }), shrine: () => T.photo('top_access_2.jpg', { alt: '周辺' }), city: () => T.photo('top_access_3.jpg', { alt: '周辺' }),
    vS: () => T.art.view('S', 'day', 3), vW: () => T.art.view('W', 'dusk', 3), vN: () => T.art.view('E', 'night', 2),
  };
  T.IMG = IMG;
  T.CONTENT = {
    brochure: [
      { cover: true, t: name(), sub: 'RESIDENCE & GALLERY', img: IMG.dusk },
      { t: 'Concept', img: IMG.night, body: ['海と山に抱かれた葉山の丘に、静けさと品格をまとう三層の邸宅。', '日常の景色そのものが、住まう方の誇りとなる住まいを目指しました。'] },
      { t: 'Architecture', img: IMG.day, body: ['水平ラインを強調したファサードは、石とガラス、木の陰影で構成。', '深い庇と大開口が、光と風を室内へ導きます。'] },
      { t: 'Entrance', img: IMG.entr, body: ['ゲストを迎える静謐なアプローチ。間接照明がゆるやかに足元を照らします。'] },
      { t: 'Living', img: IMG.lounge, body: ['天井高2,600mm、W7,200mmのワイドスパン。', 'リビングは庭と一体となる開放的な空間です。'] },
      { t: 'View', img: IMG.vS, body: ['相模湾から江の島、夕刻には富士山へ。', '階ごとに異なる眺望をお楽しみいただけます。'] },
      { t: 'Evening', img: IMG.vW, body: ['夕景は、この地に暮らす者だけの特権。'] },
      { t: 'Night', img: IMG.vN, body: ['灯りが描く街並みを、ゆっくりと。'] },
      { t: 'Outline', kv: [['所在地', '神奈川県三浦郡葉山町(サンプル)'], ['構造・規模', 'RC造 地上3階建'], ['総戸数', '24戸'], ['専有面積', '48.6㎡〜132.4㎡'], ['価格', '5,480万円〜(税込・予定)'], ['入居時期', '2027年春(予定)']] },
      { t: 'Access', img: IMG.vS, body: ['JR横須賀線 逗子駅よりバス約12分(サンプル)。', '海岸まで徒歩圏、日常使いの商業施設も近接。'] },
      { t: 'Plan', img: IMG.lounge, body: ['1LDKから4LDKまで、ライフステージに寄り添う多彩なプランをご用意。'] },
      { cover: true, t: 'Thank you', sub: 'GRANRE JADE HAYAMA', img: IMG.night },
    ],
    qbook: [
      { cover: true, t: 'Quality Book', sub: name(), img: IMG.zoom },
      { t: '構造・耐震', img: IMG.day, body: ['杭基礎+RC造、耐震等級3相当(サンプル)。', '制振ダンパーを要所に配置し、大地震後も住み続けられる安心を。'] },
      { t: '断熱・気密', img: IMG.vN, body: ['Low-E複層ガラスと外断熱工法で、年間を通じて快適な室温を保ちます。'] },
      { t: '遮音', img: IMG.lounge, body: ['二重床・二重天井、戸境壁200mm以上。生活音に配慮しています。'] },
      { t: '防犯・セキュリティ', img: IMG.night, body: ['オートロック・ダブルロック・24時間遠隔監視。'] },
      { t: '素材と仕上げ', img: IMG.lounge, body: ['無垢材、天然石、真鍮。経年で味わいが増す素材を選びました。'] },
      { t: '設備', img: IMG.lounge, body: ['ミストサウナ、食洗機、床暖房、24時間換気を標準装備。'] },
      { t: '保証・アフターサービス', kv: [['構造躯体', '10年保証'], ['防水', '10年保証'], ['設備機器', '2年保証'], ['定期点検', '3カ月 / 1年 / 2年 / 10年']] },
    ],
    slides: [
      { cover: true, t: name(), sub: 'PRESENTATION', img: IMG.dusk },
      { t: '本日のご案内', body: ['1. 物件のコンセプト', '2. 立地・周辺環境', '3. お住まいのプラン', '4. 資金計画のご提案', '5. 今後のスケジュール'] },
      { t: 'コンセプト', img: IMG.night, body: ['海と山に抱かれた、三層の邸宅。'] },
      { t: '立地・周辺環境', img: IMG.vS, body: ['海岸徒歩圏 / 商業・医療・教育施設が日常圏に揃う。'] },
      { t: 'お住まいのプラン', img: IMG.lounge, body: ['1LDK〜4LDK 全8タイプ。48.6㎡〜132.4㎡。'] },
      { t: '眺望', img: IMG.vW, body: ['階ごとに異なる景色。夕刻の富士山は格別です。'] },
      { t: '資金計画', kv: [['価格例', '7,980万円(3LDK)'], ['頭金', '1,600万円'], ['借入額', '6,380万円'], ['返済例', '月々 約18.6万円(35年・1.2%)']] },
      { t: 'ご来場予約・次のステップ', body: ['モデルルーム見学 → 間取り・仕様確認 → 資金計画 → お申し込み'] },
    ],
    docs: [
      { cover: true, t: '資料', sub: name(), img: IMG.day },
      { t: 'サンプル資料', body: ['ここに登録したPDF / Boxリンクの資料が表示されます。', '設定からURLを登録してください。'] },
      { t: '概要', kv: [['物件名', name()], ['構造', 'RC造 地上3階'], ['総戸数', '24戸']] },
      { cover: true, t: 'END', sub: name(), img: IMG.night },
    ],
  };
})();
