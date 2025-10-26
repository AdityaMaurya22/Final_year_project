import React from 'react';
import ContactUs from '../components/contact_us.js';
import TestimonialCom from '../components/testimonial_com.js';
import AboutUs from '../components/about_us.js';
import '../styles/home.css';
import '../styles/variable.css';
import HomeImg from '../images/home_sect1.jpg';
import card_img1 from '../images/logo1.png';
import card_img2 from '../images/logo2.png';
import card_img3 from '../images/logo3.png';
import video from '../images/video_test.mp4';
import { useNavigate } from "react-router-dom";


function Home() {
    const navigate = useNavigate();
    return (
        <div className="home_pg">
            <section className="home_sect1">
                <div className="container-fluid">
                    <div className="row">
                        <div className="col-lg-8">
                            <div className="sect1_intro">
                                <div className="sect1_inner_div">
                                    <h1>Welcome to TranslaNova</h1>
                                    <p>Localize Audio and Video Into different languages.</p>
                                    <p>Experience Seamless audio and video translation services with our AI-Powered platform. Join us in breaking down Language barriers and fostering global connections.</p>
                                    <button id="home_sect2">Get Started</button>
                                </div>
                            </div>
                        </div>
                        <div className="col-lg-4">
                            <div className="sect1_img">
                                <img src={HomeImg} alt="img" />
                            </div>
                        </div>
                    </div>
                </div>
            </section>
            <section className="home_sect2">
                <div className="container">
                    <div className="row">
                        <div className="col-lg-12">
                            <div className="sect2_div1">
                                <div className="sect2_div2">
                                    <h1>Services</h1>
                                    <div className="card_grid">
                                        <div className="card">
                                            <div className="card_img">
                                                <img src={card_img1} alt="Audio"></img>
                                            </div>
                                            <div className="card_content">
                                                <h2>Audio Translator</h2>
                                                <p>Convert spoken language into your preferred language in real-time with crystal-clear accuracy.</p>
                                            </div>
                                            <button>Translate Audio</button>
                                        </div>
                                        <div className="card">
                                            <div className="card_img">
                                                <img src={card_img2} alt="Video"></img>
                                            </div>
                                            <div className="card_content">
                                                <h2>Video Translator</h2>
                                                <p>Translate video content with synced subtitles and voiceover for a seamless multilingual experience.</p>
                                            </div>
                                            <button onClick={() => navigate("/video")}>Translate Video</button>
                                        </div>
                                        <div className="card">
                                            <div className="card_img">
                                                <img src={card_img3} alt="Text"></img>
                                            </div>
                                            <div className="card_content">
                                                <h2>Text Transaltor</h2>
                                                <p>Instantly translate written content with smart context detection across 50+ languages.</p>
                                            </div>
                                            <button>Translate Text</button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>
            <AboutUs />
            <TestimonialCom />
            {/* <section className="home_sect5">
                <div className="container">
                    <div className="row">
                        <div className="col-lg-12">
                            <div className="sect5_div1">
                                <video controls muted loop className="video-player">
                                    <source src={video} type="video/mp4" />
                                    Your browser does not support the video tag.
                                </video>
                            </div>
                        </div>
                    </div>
                </div>
            </section> */}
            <ContactUs />
        </div>
    );
}

export default Home;