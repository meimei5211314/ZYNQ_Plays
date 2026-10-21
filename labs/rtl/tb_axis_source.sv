`timescale 1ns/1ps

/* Deterministic scoreboard: drive at falling edges and check after NBA updates.
 * FRAME_BEATS=1 is also supported for the one-beat-packet boundary test.
 */
module tb_axis_source;
    parameter integer FRAME_BEATS = 4;
    localparam integer DATA_WIDTH = 16;

    logic aclk = 1'b0;
    logic aresetn = 1'b0;
    logic m_axis_tready = 1'b0;
    wire [DATA_WIDTH-1:0] m_axis_tdata;
    wire m_axis_tvalid;
    wire m_axis_tlast;

    integer expected_data = 0;
    integer accepted_total = 0;
    integer stalled_cycles = 0;
    integer stalled_last_cycles = 0;
    integer reset_edges = 0;
    integer i;

    always #5 aclk = ~aclk;

    axis_source #(.DATA_WIDTH(DATA_WIDTH), .FRAME_BEATS(FRAME_BEATS)) dut (
        .aclk(aclk), .aresetn(aresetn),
        .m_axis_tdata(m_axis_tdata), .m_axis_tvalid(m_axis_tvalid),
        .m_axis_tlast(m_axis_tlast), .m_axis_tready(m_axis_tready)
    );

    task automatic tick(input logic reset_n, input logic ready_input);
        logic sampled_valid;
        logic sampled_last;
        logic [DATA_WIDTH-1:0] sampled_data;
        begin
            @(negedge aclk);
            aresetn = reset_n;
            m_axis_tready = ready_input;
            #1;
            sampled_valid = m_axis_tvalid;
            sampled_data = m_axis_tdata;
            sampled_last = m_axis_tlast;
            @(posedge aclk);
            #1; // DUT nonblocking assignments have completed.
            if (!reset_n) begin
                expected_data = 0;
                reset_edges = reset_edges + 1;
                if (m_axis_tvalid !== 1'b0 || m_axis_tlast !== 1'b0 ||
                    m_axis_tdata !== {DATA_WIDTH{1'b0}})
                    $fatal(1, "synchronous active-low reset did not clear outputs");
            end else begin
                if (sampled_valid !== 1'b0 && sampled_valid !== 1'b1)
                    $fatal(1, "unknown TVALID");
                if (sampled_valid) begin
                    if (sampled_data !== expected_data[DATA_WIDTH-1:0])
                        $fatal(1, "transaction mismatch: got %0d expected %0d",
                               sampled_data, expected_data);
                    if (sampled_last !== ((expected_data % FRAME_BEATS) == FRAME_BEATS-1))
                        $fatal(1, "TLAST boundary mismatch at %0d", expected_data);
                    if (ready_input) begin
                        expected_data = expected_data + 1;
                        accepted_total = accepted_total + 1;
                    end else begin
                        stalled_cycles = stalled_cycles + 1;
                        if (sampled_last)
                            stalled_last_cycles = stalled_last_cycles + 1;
                        if (m_axis_tvalid !== sampled_valid ||
                            m_axis_tdata !== sampled_data || m_axis_tlast !== sampled_last)
                            $fatal(1, "TVALID/TDATA/TLAST changed during backpressure");
                    end
                end
                if (m_axis_tvalid !== 1'b1)
                    $fatal(1, "source did not present or retain TVALID");
                if (m_axis_tdata !== expected_data[DATA_WIDTH-1:0])
                    $fatal(1, "data advanced without handshake or failed to advance");
                if (m_axis_tlast !== ((expected_data % FRAME_BEATS) == FRAME_BEATS-1))
                    $fatal(1, "next beat has incorrect TLAST");
            end
        end
    endtask

    initial begin
        tick(1'b0, 1'b0);
        tick(1'b0, 1'b1);
        tick(1'b1, 1'b1); // first valid beat is offered after this edge
        for (i = 0; i < FRAME_BEATS-1; i = i + 1)
            tick(1'b1, 1'b1);
        // Hold the packet's last beat through three cycles of backpressure.
        tick(1'b1, 1'b0);
        tick(1'b1, 1'b0);
        tick(1'b1, 1'b0);
        tick(1'b1, 1'b1);
        for (i = 0; i < 60; i = i + 1)
            tick(1'b1, (i % 7 != 0) && (i % 7 != 1));

        // Reset while an offered beat is stalled; restart at data zero.
        tick(1'b1, 1'b0);
        tick(1'b0, 1'b0);
        tick(1'b0, 1'b1);
        tick(1'b1, 1'b0);
        tick(1'b1, 1'b0);
        for (i = 0; i < 100; i = i + 1)
            tick(1'b1, (i % 5 != 2));

        if (accepted_total < 100 || stalled_cycles < 10 ||
            stalled_last_cycles < 3 || reset_edges < 4)
            $fatal(1, "coverage conditions were not reached");
        $display("PASS axis_source: FRAME_BEATS=%0d accepted=%0d stalls=%0d last_stalls=%0d resets=%0d",
                 FRAME_BEATS, accepted_total, stalled_cycles, stalled_last_cycles, reset_edges);
        $finish;
    end

    initial begin
        #100000;
        $fatal(1, "watchdog timeout");
    end
endmodule
