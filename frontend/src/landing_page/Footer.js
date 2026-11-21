
import React from 'react';

function Footer() {
    const linkStyle = {
        color: '#666',
        textDecoration: 'none',
        fontSize: '16px',
        lineHeight: '1.5'
    };

    const headingStyle = {
        fontSize: '20px',
        fontWeight: '500',
        marginBottom: '28px',
        color: '#424242'
    };

    const iconStyle = {
        color: '#666',
        textDecoration: 'none',
        fontSize: '23px',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center'
    };

    return (
        <footer style={{ backgroundColor: 'rgb(250, 250, 250)' }}>
            <div className="container-fluid px-4 px-lg-5 pt-5 pb-4">

                <div className="row g-4 mb-5 align-items-start">

                    {/* Logo, Copyright, Social Icons and Store Badges */}
                    <div className="col-lg-3 col-md-6">

                        <img
                            src="media/images/logo.png"
                            alt="VeloTrade"
                            style={{
                                width: '215px',
                                maxWidth: '100%',
                                height: 'auto',
                                display: 'block',
                                margin: '0 0 20px 0'
                            }}
                        />

                        <p
                            style={{
                                fontSize: '16px',
                                lineHeight: '1.8',
                                marginBottom: '24px',
                                color: '#666'
                            }}
                        >
                            © 2010 - 2026, VeloTrade Broking Ltd.
                            <br />
                            All rights reserved.
                        </p>

                        {/* First row of social icons */}
                        <div className="d-flex align-items-center gap-4 mb-4">
                            <img src='media/images/twitter-x.svg'/>
                            <img src='media/images/facebook.svg'/>
                            <img src='media/images/instagram.svg'/>
                            <a href="" aria-label="LinkedIn" style={iconStyle}>
                                <strong>in</strong>
                            </a>
                        </div>

                        <hr
                            style={{
                                borderColor: '#ddd',
                                margin: '28px 0'
                            }}
                        />

                        {/* Second row of social icons */}
                        <div className="d-flex align-items-center gap-4 mb-4">
                            <img src='media/images/youtube.svg'/>
                            <img src='media/images/whatsapp.svg'/>
                            <img src='media/images/telegram.svg'/>
                        </div>

                        {/* Store badges on the same line */}
                        <div
                            className="d-flex flex-nowrap align-items-center gap-2 mt-4"
                            style={{ width: '100%' }}
                        >
                            <a
                                href=""
                                aria-label="Google Play"
                                className="flex-fill"
                                style={{ minWidth: 0 }}
                            >
                                <img
                                    src="media/images/googlePlayBadge.svg"
                                    alt="Get it on Google Play"
                                    className="img-fluid"
                                    style={{
                                        display: 'block',
                                        width: '100%',
                                        height: 'auto'
                                    }}
                                />
                            </a>

                            <a
                                href=""
                                aria-label="App Store"
                                className="flex-fill"
                                style={{ minWidth: 0 }}
                            >
                                <img
                                    src="media/images/appstoreBadge.svg"
                                    alt="Download on the App Store"
                                    className="img-fluid"
                                    style={{
                                        display: 'block',
                                        width: '100%',
                                        height: 'auto'
                                    }}
                                />
                            </a>
                        </div>
                    </div>

                    {/* Company */}
                    <div className="col-lg-3 col-md-6">
                        <p style={headingStyle}>Company</p>

                        <div className="d-flex flex-column gap-3">
                            <a href="" style={linkStyle}>About</a>
                            <a href="" style={linkStyle}>Products</a>
                            <a href="" style={linkStyle}>Pricing</a>
                            <a href="" style={linkStyle}>Referral programme</a>
                            <a href="" style={linkStyle}>careers</a>
                            <a href="" style={linkStyle}>VeloTrade.tech</a>
                            <a href="" style={linkStyle}>Press &amp; media</a>
                            <a href="" style={linkStyle}>VeloTrade cares (CSR)</a>
                        </div>
                    </div>

                    {/* Support */}
                    <div className="col-lg-3 col-md-6">
                        <p style={headingStyle}>Support</p>

                        <div className="d-flex flex-column gap-3">
                            <a href="" style={linkStyle}>Support</a>
                            <a href="" style={linkStyle}>Contact</a>
                            <a href="" style={linkStyle}>Support portal</a>
                            <a href="" style={linkStyle}>z-connect blog</a>
                            <a href="" style={linkStyle}>List of charges</a>
                            <a href="" style={linkStyle}>Downloads and resources</a>
                        </div>
                    </div>

                    {/* Account */}
                    <div className="col-lg-3 col-md-6">
                        <p style={headingStyle}>Account</p>

                        <div className="d-flex flex-column gap-3">
                            <a href="" style={linkStyle}>Open an accound</a>
                            <a href="" style={linkStyle}>Fund transfer</a>
                            <a href="" style={linkStyle}>60 day challenge</a>
                        </div>
                    </div>

                </div>

                {/* Original legal information */}
                <div
                    className="mt-5 text-muted"
                    style={{
                        fontSize: '14px',
                        lineHeight: '1.8'
                    }}
                >
                    <p>
                        Zerodha Broking Ltd.: Member of NSE​ &​ BSE – SEBI Registration no.:
                        INZ000031633 CDSL: Depository services through Zerodha Securities
                        Pvt. Ltd. – SEBI Registration no.: IN-DP-100-2015 Commodity Trading
                        through Zerodha Commodities Pvt. Ltd. MCX: 46025 – SEBI Registration
                        no.: INZ000038238 Registered Address: Zerodha Broking Ltd.,
                        #153/154, 4th Cross, Dollars Colony, Opp. Clarence Public School,
                        J.P Nagar 4th Phase, Bengaluru - 560078, Karnataka, India. For any
                        complaints pertaining to securities broking please write to
                        complaints@zerodha.com, for DP related to dp@zerodha.com. Please
                        ensure you carefully read the Risk Disclosure Document as prescribed
                        by SEBI | ICF
                    </p>

                    <p>
                        Procedure to file a complaint on SEBI SCORES: Register on SCORES
                        portal. Mandatory details for filing complaints on SCORES: Name,
                        PAN, Address, Mobile Number, E-mail ID. Benefits: Effective
                        Communication, Speedy redressal of the grievances
                    </p>

                    <p>
                        Investments in securities market are subject to market risks; read
                        all the related documents carefully before investing.
                    </p>

                    <p>
                        "Prevent unauthorised transactions in your account. Update your
                        mobile numbers/email IDs with your stock brokers. Receive
                        information of your transactions directly from Exchange on your
                        mobile/email at the end of the day. Issued in the interest of
                        investors. KYC is one time exercise while dealing in securities
                        markets - once KYC is done through a SEBI registered intermediary
                        (broker, DP, Mutual Fund etc.), you need not undergo the same
                        process again when you approach another intermediary." Dear
                        Investor, if you are subscribing to an IPO, there is no need to
                        issue a cheque. Please write the Bank account number and sign the
                        IPO application form to authorize your bank to make payment in case
                        of allotment. In case of non allotment the funds will remain in your
                        bank account. As a business we don't give stock tips, and have not
                        authorized anyone to trade on behalf of others. If you find anyone
                        claiming to be part of Zerodha and offering such services, please
                        create a ticket here.
                    </p>
                </div>

            </div>
        </footer>
    );
}

export default Footer;
