# SHALX NETGUARD Zeek Local Logging Script
# Location: /opt/zeek/share/zeek/site/local.zeek

@load protocols/conn/mac-logging
@load protocols/ssl/validate-certs
@load protocols/http/header-names

# Output format: JSON logs for high-performance indexing
redef LogAscii::use_json = T;
redef LogAscii::json_timestamps = JSON::TS_ISO8601;

# Enable standard analyzers
@load base/protocols/conn
@load base/protocols/dns
@load base/protocols/http
@load base/protocols/ssl
