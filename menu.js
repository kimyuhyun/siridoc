const menu = [
    {
        title: "회원관리",
        child: [
            {
                title: "권한 관리",
                link: "/adm/grade",
            },
            {
                title: "관리자 관리",
                link: "/adm/manager/1",
            },
            {
                title: "회원 관리",
                link: "/adm/user/1",
            },
            {
                title: "나의 환자 관리",
                link: "/patient/list/patient?table=MEMB_tbl",
            },
        ],
    },
    {
        title: "상품-병원-블로그등록",
        child: [
            {
                title: "건강기능식품",
                link: "/crud/list/health_food?table=HEALTH_FOOD_tbl",
            },
            {
                title: "건강보조기",
                link: "/crud/list/health_mac?table=HEALTH_MAC_tbl",
            },
            {
                title: "건강블로그",
                link: "/crud/list/health_blog?table=HEALTH_BLOG_tbl",
            },
            {
                title: "병원",
                link: "/crud/list/hospital?table=HOSPITAL_tbl",
            },
        ],
    },
    {
        title: "게시판",
        child: [
            {
                title: "공지사항",
                link: "/crud/list/notice?table=BOARD_tbl&board_id=notice&step=1&is_use=1",
            },
            {
                title: "고객센터",
                link: "/crud/list/cscenter?table=BOARD_tbl&board_id=cscenter&step=1&is_use=1",
            },
            {
                title: "신고",
                link: "/crud/list/singo?table=BOARD_tbl&board_id=singo&step=1&is_use=1",
            },
        ],
    },

    {
        title: "통계",
        child: [
            {
                title: "전체방문자",
                link: "/analyzer/graph1",
            },
            {
                title: "트래픽수",
                link: "/analyzer/graph2",
            },
            {
                title: "시간대별",
                link: "/analyzer/graph3",
            },
            {
                title: "현재접속자",
                link: "/analyzer/liveuser",
            },
        ],
    },
];

module.exports = menu;
