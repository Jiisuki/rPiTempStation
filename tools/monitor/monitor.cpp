//
// Created by Jiisuki on 2021-10-24.
//

#include <iostream>

#include <gr_ipc.h>
#include <common.h>
#include <csignal>
#include <curses.h>
#include "ui_defs.h"

struct ranges
{
    float r1;
    float r2;
    ranges() : r1(), r2() {}
    ranges(float normal_lower, float normal_upper) : r1(normal_lower), r2(normal_upper) {}
    ~ranges() = default;
};

static void signal_handler(int v);
static void init_curses();
static void print_header();
static void update_monitor(common::temp_data& data);
static void write_line_t(int line_no, const std::string& header, float mean, const ranges& rng);
static void write_line_rh(int line_no, const std::string& header, float mean, const ranges& rng);

static int scr_r, scr_c;

static common::abortable_delay* loop_delay;

int main ()
{
    loop_delay = new common::abortable_delay (100);

    ipc::context_t ctx {};
    ipc::subscriber subscriber (ctx, "temp");

    /* Init curses. */
    init_curses();

    /* Write UI header line. */
    print_header();

    do
    {
        try
        {
            common::temp_data data {};
            if (subscriber.poll(&data, sizeof(common::temp_data)))
            {
                update_monitor(data);
            }
        }
        catch (const zmq::error_t& error)
        {
            std::cerr << error.what() << std::endl;
            loop_delay->abort();
        }
    }
    while (loop_delay->wait());

    delete loop_delay;

    return (0);
}

static void init_curses()
{
    ESCDELAY = 1;
    initscr();
    start_color();
    init_pair(UI_COLOR_RED, COLOR_RED, COLOR_BLACK);
    init_pair(UI_COLOR_YELLOW, COLOR_YELLOW, COLOR_BLACK);
    init_pair(UI_COLOR_GREEN, COLOR_GREEN, COLOR_BLACK);
    init_pair(UI_COLOR_BLUE, COLOR_BLUE, COLOR_BLACK);
    curs_set(0);
    cbreak();
    timeout(0); /* don't block. */
    keypad(stdscr, true);
    noecho();
    getmaxyx(stdscr, scr_r, scr_c);
}

static void print_header()
{
    const char text1[] = "Temperature Monitor";
    const int padding1 = scr_c - (int) (sizeof(text1)/sizeof(*text1));

    attrset(A_REVERSE);
    mvprintw(0, 0, text1);
    for (int i = 0; i < padding1; i++)
    {
        printw(" ");
    }
    attrset(A_NORMAL);

    move(1, 0);
    M_SHORTCUT("CTRL+C  ", "Quit   ");

    move(2, 0);
    hline(ACS_HLINE, scr_c);

    refresh();
}

static void update_monitor(common::temp_data& data)
{
    enum class lines : int
    {
        inside_t = 4,
        outside_t,
        __separator_1,
        inside_rh,
        outside_rh,
        __separator_2,
        averages,
        __separator_3,
        temp_desc_1,
        temp_desc_2,
        temp_desc_3,
        __separator_4,
        rh_desc_1,
        rh_desc_2,
        rh_desc_3,
        __separator_5,
        last_update,
    };

    static common::average<float, 60> inside_avg_t {};
    static common::average<float, 60> inside_avg_rh {};
    static common::average<float, 60> outside_avg_t {};
    static common::average<float, 60> outside_avg_rh {};

    /* Allocate average of last minute or so. */
    inside_avg_t.add(data.inside_t);
    inside_avg_rh.add(data.inside_rh);
    outside_avg_t.add(data.outside_t);
    outside_avg_rh.add(data.outside_rh);

    auto inside_t_mean = inside_avg_t.mean();
    auto inside_t_rng  = inside_avg_t.range();
    auto outside_t_mean = outside_avg_t.mean();
    auto outside_t_rng  = outside_avg_t.range();
    auto inside_rh_mean = inside_avg_rh.mean();
    auto inside_rh_rng  = inside_avg_rh.range();
    auto outside_rh_mean = outside_avg_rh.mean();
    auto outside_rh_rng  = outside_avg_rh.range();

    const ranges rng_temperature (15.0, 25.0);
    const ranges rng_rel_humidity (25, 55);
    static bool written_ranges = false;

    if (!written_ranges)
    {
        written_ranges = true;

        SET_LINE((int) lines::temp_desc_1); TEMP_COLOR(rng_temperature.r1 - 1, rng_temperature); printw("Cold   "); printw("%4.1f", rng_temperature.r1); addch(' '); addch(ACS_DEGREE);
        SET_LINE((int) lines::temp_desc_2); TEMP_COLOR(rng_temperature.r1 + 1, rng_temperature); printw("Normal "); printw("%4.1f", rng_temperature.r1); addch(' '); addch(ACS_DEGREE); printw(" - %4.1f", rng_temperature.r2); addch(' '); addch(ACS_DEGREE);
        SET_LINE((int) lines::temp_desc_3); TEMP_COLOR(rng_temperature.r2 + 1, rng_temperature); printw("Hot    "); printw("%4.1f", rng_temperature.r2); addch(' '); addch(ACS_DEGREE);

        SET_LINE((int) lines::rh_desc_1); TEMP_COLOR(rng_rel_humidity.r1 - 1, rng_rel_humidity); printw("Dry    "); printw("%4.1f", rng_rel_humidity.r1); addch(' '); addch('%');
        SET_LINE((int) lines::rh_desc_2); TEMP_COLOR(rng_rel_humidity.r1 + 1, rng_rel_humidity); printw("Normal "); printw("%4.1f", rng_rel_humidity.r1); addch(' '); addch('%'); printw(" - %4.1f", rng_rel_humidity.r2); addch(' '); addch('%');
        SET_LINE((int) lines::rh_desc_3); TEMP_COLOR(rng_rel_humidity.r2 + 1, rng_rel_humidity); printw("Humid  "); printw("%4.1f", rng_rel_humidity.r2); addch(' '); addch('%');
    }

    write_line_t( (int) lines::inside_t,   "Temperature inside: ", inside_t_mean,   rng_temperature);
    write_line_t( (int) lines::outside_t,  "Temperature outside:", outside_t_mean,  rng_temperature);
    write_line_rh((int) lines::inside_rh,  "Humidity inside:    ", inside_rh_mean,  rng_rel_humidity);
    write_line_rh((int) lines::outside_rh, "Humidity outside:   ", outside_rh_mean, rng_rel_humidity);

    SET_LINE((int) lines::averages);
    attrset(A_NORMAL);
    printw("Averages: %u", inside_avg_t.n());
    clrtoeol();

    SET_LINE((int) lines::last_update);
    attrset(A_NORMAL);
    auto t = (std::time_t) data.unix_ts;
    printw("Updated: %s", std::asctime(std::localtime(&t)));
    clrtoeol();

    refresh();
}

static void write_line_t(int line_no, const std::string& header, float mean, const ranges& rng)
{
    SET_LINE(line_no);
    M_BOLD(header.c_str());
    attrset(A_NORMAL);
    printw("   ");
    TEMP_COLOR(mean, rng);
    printw("%6.3f", mean);
    attrset(A_NORMAL);
    addch(' ');
    addch(ACS_DEGREE);
    clrtoeol();
}

static void write_line_rh(int line_no, const std::string& header, float mean, const ranges& rng)
{
    SET_LINE(line_no);
    M_BOLD(header.c_str());
    attrset(A_NORMAL);
    printw("   ");
    TEMP_COLOR(mean, rng);
    printw("%6.3f", mean);
    attrset(A_NORMAL);
    addch(' ');
    addch('%');
    clrtoeol();
}
