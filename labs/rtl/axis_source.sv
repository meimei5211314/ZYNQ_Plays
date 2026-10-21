`timescale 1ns/1ps

/* AXI4-Stream counter source, one counter word per beat.
 * aresetn is ACTIVE-LOW SYNCHRONOUS: sampled only at rising aclk edges.
 * Reset clears TVALID, TDATA and TLAST; first beat appears at the next
 * rising edge with aresetn=1. Reset cancels any offered, unaccepted beat.
 */
module axis_source #(
    parameter integer DATA_WIDTH = 16,
    parameter integer FRAME_BEATS = 8
) (
    input  wire                  aclk,
    input  wire                  aresetn,
    output logic [DATA_WIDTH-1:0] m_axis_tdata,
    output logic                 m_axis_tvalid,
    output logic                 m_axis_tlast,
    input  wire                  m_axis_tready
);
    localparam integer INDEX_WIDTH = FRAME_BEATS <= 1 ? 1 : $clog2(FRAME_BEATS);
    logic [INDEX_WIDTH-1:0] beat_index;

    // synthesis translate_off
    initial begin
        if (DATA_WIDTH < 1 || FRAME_BEATS < 1)
            $fatal(1, "DATA_WIDTH and FRAME_BEATS must both be positive");
    end
    // synthesis translate_on

    always @(posedge aclk) begin
        if (!aresetn) begin
            m_axis_tvalid <= 1'b0;
            m_axis_tdata <= {DATA_WIDTH{1'b0}};
            m_axis_tlast <= 1'b0;
            beat_index <= {INDEX_WIDTH{1'b0}};
        end else if (!m_axis_tvalid) begin
            // Offer beat zero independently of TREADY.
            m_axis_tvalid <= 1'b1;
            m_axis_tdata <= {DATA_WIDTH{1'b0}};
            m_axis_tlast <= (FRAME_BEATS == 1);
            beat_index <= {INDEX_WIDTH{1'b0}};
        end else if (m_axis_tready) begin
            // The old beat was accepted: only a handshake advances the data.
            m_axis_tdata <= m_axis_tdata + 1'b1;
            if (beat_index == FRAME_BEATS-1) begin
                beat_index <= {INDEX_WIDTH{1'b0}};
                m_axis_tlast <= (FRAME_BEATS == 1);
            end else begin
                beat_index <= beat_index + 1'b1;
                m_axis_tlast <= (beat_index == FRAME_BEATS-2);
            end
        end
        // With TVALID=1 and TREADY=0 every output register holds its value.
    end
endmodule
